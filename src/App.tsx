/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { MenuSection } from './components/MenuSection';
import { ItemDetailModal } from './components/ItemDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { OrderStatusTracker } from './components/OrderStatusTracker';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPanel } from './components/AdminPanel';
import { MenuItem, CartItem, CartItemOption, Order, OrderStatus } from './types';
import { INITIAL_MENU_ITEMS } from './data/initialMenu';
import { Coffee, MapPin, Phone, Instagram, Send, Heart, Clock, ShoppingBag, ShieldCheck } from 'lucide-react';
import { toPersianDigits, getStatusDetails } from './utils/formatters';
import { playNewOrderChime, playStatusUpdateChime } from './utils/audio';
import {
  fetchMenuApi,
  fetchOrdersApi,
  updateOrderStatusApi,
  saveLocalOrders,
  getLocalOrders,
} from './services/apiService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'menu' | 'track' | 'admin'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  
  // All Orders across the cafe (used by Admin Panel)
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  
  // Specific Order IDs placed by THIS customer/browser session
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pcafe_my_order_ids');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return [];
  });

  // Client Cart (persisted per device session)
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('pcafe_cart_items');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('pcafe_cart_items', JSON.stringify(cartItems));
    } catch (e) {
      // ignore
    }
  }, [cartItems]);

  // Derived: Only this customer's orders for the Tracking view
  const myOrders = React.useMemo(() => {
    const idSet = new Set(myOrderIds);
    return allOrders.filter((o) => idSet.has(o.id));
  }, [allOrders, myOrderIds]);
  
  // Modals
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  
  // Loading & Toast
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fresh Refs for real-time SSE listeners
  const isAdminLoggedInRef = useRef<boolean>(isAdminLoggedIn);
  useEffect(() => {
    isAdminLoggedInRef.current = isAdminLoggedIn;
  }, [isAdminLoggedIn]);

  const myOrderIdsRef = useRef<string[]>(myOrderIds);
  useEffect(() => {
    myOrderIdsRef.current = myOrderIds;
  }, [myOrderIds]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Fetch Menu from API (with fallback)
  const fetchMenu = async () => {
    try {
      const items = await fetchMenuApi();
      if (Array.isArray(items) && items.length > 0) {
        setMenuItems(items);
      }
    } catch (e) {
      console.error('Error fetching menu:', e);
    }
  };

  // Fetch Orders from API (with fallback)
  const fetchOrders = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchOrdersApi();
      if (Array.isArray(data)) {
        const seen = new Set<string>();
        const uniqueOrders: Order[] = [];
        for (const ord of data) {
          if (ord && ord.id && !seen.has(ord.id)) {
            seen.add(ord.id);
            uniqueOrders.push(ord);
          }
        }
        setAllOrders(uniqueOrders);
      }
    } catch (e) {
      console.warn('Error fetching orders:', e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Real-time EventSource (SSE) + Fast 3-second smart background sync
  useEffect(() => {
    fetchMenu();
    fetchOrders(false);

    // 1. Establish SSE Live Stream for sub-second cross-device push notifications
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('new_order', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && payload.order) {
            const newOrder: Order = payload.order;
            setAllOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });

            // ONLY notify if user is an Admin logged in to manage the cafe
            if (isAdminLoggedInRef.current) {
              playNewOrderChime();
              showToast(`🔔 سفارش جدید #PC-${newOrder.orderNumber} (میز ${newOrder.tableNumber || 'بیرون‌بر'}) ثبت شد!`);
            }
          }
        } catch (err) {
          console.error('Error handling SSE new_order:', err);
        }
      });

      eventSource.addEventListener('order_status_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && payload.order) {
            const updatedOrder: Order = payload.order;
            setAllOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );

            // Check if this status update belongs to THIS customer
            const isMyOrder = myOrderIdsRef.current.includes(updatedOrder.id);
            if (isMyOrder) {
              playStatusUpdateChime();
              const details = getStatusDetails(updatedOrder.status);
              showToast(`☕ وضعیت سفارش شما #PC-${updatedOrder.orderNumber} تغییر کرد: «${details.label}»`);
            } else if (isAdminLoggedInRef.current) {
              const details = getStatusDetails(updatedOrder.status);
              showToast(`وضعیت سفارش #PC-${updatedOrder.orderNumber} به «${details.label}» تغییر یافت.`);
            }
          }
        } catch (err) {
          console.error('Error handling SSE status update:', err);
        }
      });

      eventSource.addEventListener('orders_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && Array.isArray(payload.orders)) {
            setAllOrders(payload.orders);
          }
        } catch (err) {
          console.error('Error handling SSE orders_updated:', err);
        }
      });

      eventSource.addEventListener('orders_cleared', () => {
        setAllOrders([]);
      });

      eventSource.addEventListener('menu_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && Array.isArray(payload.menu)) {
            setMenuItems(payload.menu);
          }
        } catch (err) {
          console.error('Error handling SSE menu_updated:', err);
        }
      });

      eventSource.onerror = () => {
        // SSE will automatically reconnect in background
      };
    } catch (sseErr) {
      console.warn('SSE not supported or failed to connect:', sseErr);
    }

    // 2. High-speed 3-second background polling fallback to guarantee 100% real-time sync across devices
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 3000);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Cart Handlers
  const handleAddToCart = (
    item: MenuItem,
    quantity: number,
    options?: CartItemOption,
    specialNote?: string
  ) => {
    const extraPrice = (options?.extraShot ? 25000 : 0);
    const unitPrice = item.price + extraPrice;
    const cartItemId = `${item.id}-${JSON.stringify(options || {})}-${specialNote || ''}`;

    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.id === cartItemId);
      if (existing) {
        return prev.map((ci) =>
          ci.id === cartItemId
            ? {
                ...ci,
                quantity: ci.quantity + quantity,
                itemTotal: (ci.quantity + quantity) * unitPrice,
              }
            : ci
        );
      } else {
        return [
          ...prev,
          {
            id: cartItemId,
            menuItem: item,
            quantity,
            options,
            itemTotal: quantity * unitPrice,
            specialNote,
          },
        ];
      }
    });

    showToast(`☕ «${item.name}» به سبد سفارش شما اضافه شد`);
  };

  const handleQuickAdd = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    handleAddToCart(item, 1);
  };

  const handleUpdateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveCartItem(cartItemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((ci) => {
        if (ci.id === cartItemId) {
          const unitPrice = ci.itemTotal / ci.quantity;
          return {
            ...ci,
            quantity: newQuantity,
            itemTotal: newQuantity * unitPrice,
          };
        }
        return ci;
      })
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.id !== cartItemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    try {
      localStorage.removeItem('pcafe_cart_items');
    } catch (e) {}
  };

  // When customer successfully submits an order
  const handleOrderSuccess = (newOrder: Order) => {
    // 1. Add order ID to this customer's private storage
    setMyOrderIds((prev) => {
      const updated = [newOrder.id, ...prev.filter((id) => id !== newOrder.id)];
      try {
        localStorage.setItem('pcafe_my_order_ids', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 2. Add to allOrders cache
    setAllOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);

    // 3. Clear customer's cart
    handleClearCart();

    // 4. Switch to private tracking tab
    setActiveTab('track');
    showToast(`🎉 سفارش #PC-${newOrder.orderNumber} با موفقیت ثبت شد و به باریستا ارسال گردید!`);
  };

  // Lookup Order by ID / OrderNumber / Phone and attach to my orders
  const handleLookupOrder = async (query: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/orders/lookup/${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.order) {
          const foundOrder: Order = data.order;
          setAllOrders((prev) => [foundOrder, ...prev.filter((o) => o.id !== foundOrder.id)]);
          setMyOrderIds((prev) => {
            if (prev.includes(foundOrder.id)) return prev;
            const updated = [foundOrder.id, ...prev];
            try {
              localStorage.setItem('pcafe_my_order_ids', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
          return true;
        }
      }
    } catch (e) {
      console.error('Lookup order error:', e);
    }
    return false;
  };

  // Admin Actions
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatusApi(orderId, newStatus);
      setAllOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o))
      );
      showToast('وضعیت سفارش بروزرسانی شد.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleItemAvailability = async (itemId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMenuItems((prev) =>
          prev.map((it) => (it.id === itemId ? updated : it))
        );
        showToast(`وضعیت موجودی آیتم بروز شد.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddItem = async (itemData: Partial<MenuItem>) => {
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
      if (res.ok) {
        const created = await res.json();
        setMenuItems((prev) => [created, ...prev]);
        showToast('آیتم جدید با موفقیت به منو اضافه شد.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateItem = async (itemId: string, itemData: Partial<MenuItem>) => {
    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
      if (res.ok) {
        const updated = await res.json();
        setMenuItems((prev) =>
          prev.map((it) => (it.id === itemId ? updated : it))
        );
        showToast('تغییرات آیتم منو ذخیره گردید.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/menu/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        setMenuItems((prev) => prev.filter((it) => it.id !== itemId));
        showToast('آیتم با موفقیت از منو حذف شد.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllOrders = async (): Promise<boolean> => {
    try {
      fetch('/api/orders/all', { method: 'DELETE' }).catch(() => {});
      setAllOrders([]);
      setMyOrderIds([]);
      saveLocalOrders([]);
      try {
        localStorage.removeItem('pcafe_my_order_ids');
        localStorage.removeItem('pcafe_all_orders');
      } catch (e) {}
      showToast('🗑️ تمامی سفارش‌ها با موفقیت پاکسازی شدند.');
      return true;
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.itemTotal, 0);
  const cartItemIds = new Set(cartItems.map((ci) => ci.menuItem.id));
  
  // Badge counts only this customer's active orders (or all active if admin is logged in)
  const activeOrderCount = isAdminLoggedIn
    ? allOrders.filter((o) => o.status === 'pending' || o.status === 'preparing').length
    : myOrders.filter((o) => o.status === 'pending' || o.status === 'preparing').length;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-black overflow-x-hidden w-full max-w-full">
      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cartCount}
        cartTotal={cartTotal}
        openCart={() => setIsCartOpen(true)}
        openAdminModal={() => setIsAdminLoginOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        activeOrderCount={activeOrderCount}
      />

      {/* Main View Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        <AnimatePresence mode="wait">
          {activeTab === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <MenuSection
                menuItems={menuItems}
                onSelectItem={(item) => setSelectedMenuItem(item)}
                onQuickAdd={handleQuickAdd}
                cartItemIds={cartItemIds}
              />
            </motion.div>
          )}

          {activeTab === 'track' && (
            <motion.div
              key="track"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <OrderStatusTracker
                orders={myOrders}
                onRefresh={() => fetchOrders(true)}
                isLoading={isLoading}
                onNavigateToMenu={() => setActiveTab('menu')}
                onLookupOrder={handleLookupOrder}
              />
            </motion.div>
          )}

          {activeTab === 'admin' && isAdminLoggedIn && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminPanel
                orders={allOrders}
                menuItems={menuItems}
                onRefreshOrders={fetchOrders}
                onRefreshMenu={fetchMenu}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onToggleItemAvailability={handleToggleItemAvailability}
                onAddItem={handleAddItem}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onClearAllOrders={handleClearAllOrders}
                onLogout={() => {
                  setIsAdminLoggedIn(false);
                  setActiveTab('menu');
                  showToast('با موفقیت از پنل مدیریت خارج شدید.');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals & Drawers */}
      <ItemDetailModal
        item={selectedMenuItem}
        onClose={() => setSelectedMenuItem(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOrderSuccess={handleOrderSuccess}
      />

      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={() => {
          setIsAdminLoggedIn(true);
          setActiveTab('admin');
          showToast('ورود موفق به پنل مدیریت کافه پی');
        }}
      />

      {/* Toast Notification Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 left-6 sm:left-auto sm:max-w-md z-50 bg-stone-900/95 border border-amber-500/50 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold"
          >
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-stone-400 hover:text-white text-xs"
            >
              بستن
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Luxury Persian Footer */}
      <footer className="mt-auto bg-stone-950 border-t border-stone-800/80 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-black">
                  P
                </div>
                <span className="font-black text-xl text-white">P CAFE</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                کافه تخصصی و رستر P Cafe — ارائه‌دهنده قهوه‌های تک‌خاستگاه اسپشالتی، بار سرد دست‌ساز و شیرینی‌های تازه فرانسوی.
              </p>
            </div>

            {/* Working Hours */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                ساعات کاری کافه:
              </h4>
              <p className="text-xs text-stone-300 font-mono">
                شنبه تا پنج‌شنبه: 08:00 صبح الی 23:30 شب
              </p>
              <p className="text-xs text-stone-300 font-mono">
                جمعه‌ها و روزهای تعطیل: 09:30 صبح الی 24:00 شب
              </p>
            </div>

            {/* Location & Contact */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                آدرس و دسترسی:
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed">
                فردیس ، فلکه سوم ، پی کافه
              </p>
              <p className="text-xs text-stone-300 font-mono">
                تلفن تماس: <a href="tel:02122003344" className="text-amber-400 hover:underline" dir="ltr">021-22003344</a>
              </p>
            </div>

            {/* Social & Contact */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <Instagram className="w-4 h-4 text-pink-400" />
                شبکه‌های ارتباطی کافه:
              </h4>
              <div className="space-y-2">
                <a
                  href="https://instagram.com/p____cafe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-stone-300 hover:text-amber-400 transition-colors p-2 rounded-xl bg-stone-900 border border-stone-800"
                >
                  <Instagram className="w-4 h-4 text-pink-400" />
                  <span className="font-mono" dir="ltr">@p____cafe</span>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
            <p>© {toPersianDigits(1405)} تمامی حقوق برای کافه پی محفوظ است.</p>
            <p className="flex items-center gap-1.5">
              <span>طراحی شده توسط</span>
              <a
                href="https://t.me/yasinabolfathi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 font-bold transition-colors underline underline-offset-4"
              >
                یاسین ابوالفتحی
              </a>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (Smartphones & Tablets < md) */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-stone-950/95 backdrop-blur-xl border-t border-amber-500/20 px-3 py-2 shadow-2xl">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Menu Tab */}
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'menu'
                ? 'text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'menu' ? 'bg-amber-500/20' : ''}`}>
              <Coffee className="w-5 h-5" />
            </div>
            <span className="text-[10px]">منوی کافه</span>
          </button>

          {/* Tracking Tab */}
          <button
            onClick={() => setActiveTab('track')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl relative transition-all ${
              activeTab === 'track'
                ? 'text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg relative ${activeTab === 'track' ? 'bg-amber-500/20' : ''}`}>
              <Clock className="w-5 h-5" />
              {activeOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white shadow">
                  {toPersianDigits(activeOrderCount)}
                </span>
              )}
            </div>
            <span className="text-[10px]">پیگیری سفارش</span>
          </button>

          {/* Cart Tab */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-stone-400 hover:text-stone-200 relative transition-all"
          >
            <div className="p-1 rounded-lg relative">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-stone-950 shadow">
                  {toPersianDigits(cartCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-amber-400 font-bold">سبد خرید</span>
          </button>

          {/* Admin Tab */}
          <button
            onClick={() => {
              if (isAdminLoggedIn) {
                setActiveTab('admin');
              } else {
                setIsAdminLoginOpen(true);
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'admin'
                ? 'text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'admin' ? 'bg-amber-500/20' : ''}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px]">پنل مدیریت</span>
          </button>
        </div>
      </div>
    </div>
  );
}

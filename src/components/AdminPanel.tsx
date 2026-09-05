import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coffee,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bell,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  Send,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  Sliders,
  LogOut,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Order, MenuItem, OrderStatus, CategoryId } from '../types';
import { CATEGORIES } from '../data/initialMenu';
import {
  formatPriceToman,
  formatRelativeTime,
  formatPersianTimeOnly,
  toPersianDigits,
  getStatusDetails,
} from '../utils/formatters';

interface AdminPanelProps {
  orders: Order[];
  menuItems: MenuItem[];
  onRefreshOrders: () => void;
  onRefreshMenu: () => void;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => Promise<void>;
  onToggleItemAvailability: (itemId: string, currentStatus: boolean) => Promise<void>;
  onAddItem: (item: Partial<MenuItem>) => Promise<void>;
  onUpdateItem: (itemId: string, item: Partial<MenuItem>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onClearAllOrders?: () => Promise<boolean>;
  onLogout: () => void;
}

type AdminTab = 'live-orders' | 'analytics' | 'menu-management' | 'telegram-settings';
type TimeFilter = 'today' | 'weekly' | 'monthly' | 'yearly';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  orders,
  menuItems,
  onRefreshOrders,
  onRefreshMenu,
  onUpdateOrderStatus,
  onToggleItemAvailability,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onClearAllOrders,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('live-orders');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  // Clear orders confirmation modal state
  const [isClearOrdersModalOpen, setIsClearOrdersModalOpen] = useState<boolean>(false);
  const [isClearingOrders, setIsClearingOrders] = useState<boolean>(false);

  // Stats fetched from backend
  const [statsData, setStatsData] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

  // Telegram test response feedback
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [isTestingTg, setIsTestingTg] = useState<boolean>(false);

  // Add / Edit Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    enName: '',
    category: 'hot-coffee' as CategoryId,
    price: 85000,
    description: '',
    ingredients: '',
    image: '',
    prepTime: 5,
    isPopular: false,
    isSpecial: false,
    isAvailable: true,
  });

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [orders]);

  const testTelegram = async () => {
    setIsTestingTg(true);
    setTelegramStatus(null);
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus('✅ پیام تست با موفقیت به کانال @pcafedata ارسال شد!');
      } else {
        setTelegramStatus(`❌ خطا در ارسال به تلگرام: ${data.error || 'ناشناخته'}`);
      }
    } catch (e: any) {
      setTelegramStatus(`❌ خطا: ${e.message}`);
    } finally {
      setIsTestingTg(false);
    }
  };

  const backupToTelegram = async () => {
    setIsTestingTg(true);
    setTelegramStatus(null);
    try {
      const res = await fetch('/api/telegram/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus('📦 بکاپ کامل داده‌های کافه به کانال @pcafedata مخابره گردید.');
      } else {
        setTelegramStatus(`❌ خطا در ارسال بکاپ: ${data.error}`);
      }
    } catch (e: any) {
      setTelegramStatus(`❌ خطا: ${e.message}`);
    } finally {
      setIsTestingTg(false);
    }
  };

  const restoreFromTelegram = async () => {
    setIsTestingTg(true);
    setTelegramStatus(null);
    try {
      const res = await fetch('/api/telegram/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onRefreshOrders();
        setTelegramStatus(`🔄 همگام‌سازی انجام شد: ${data.restored} سفارش از پیام‌های کانال بازیابی شد (مجموع: ${data.totalOrders} سفارش).`);
      } else {
        setTelegramStatus(`❌ خطا در بازیابی: ${data.error || 'دسترسی مقدور نشد'}`);
      }
    } catch (e: any) {
      setTelegramStatus(`❌ خطا: ${e.message}`);
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleOpenClearModal = () => {
    setIsClearOrdersModalOpen(true);
  };

  const handleConfirmClearOrders = async () => {
    setIsClearingOrders(true);
    try {
      if (onClearAllOrders) {
        await onClearAllOrders();
      } else {
        const res = await fetch('/api/orders/all', { method: 'DELETE' });
        if (res.ok) {
          onRefreshOrders();
        }
      }
      setTelegramStatus('🗑️ تمامی سفارش‌ها با موفقیت از دیتابیس پاکسازی شدند.');
      fetchStats();
      setIsClearOrdersModalOpen(false);
    } catch (e: any) {
      setTelegramStatus(`❌ خطا در پاکسازی سفارش‌ها: ${e.message}`);
    } finally {
      setIsClearingOrders(false);
    }
  };

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  const activeOrdersCount = orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length;

  // Filtered Menu Items
  const filteredMenuItems = menuItems.filter((it) => {
    const matchCat = selectedCategory === 'all' || it.category === selectedCategory;
    const matchSearch =
      it.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      it.enName.toLowerCase().includes(menuSearch.toLowerCase()) ||
      it.description.toLowerCase().includes(menuSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // Handle Open Create / Edit item
  const openCreateItem = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      enName: '',
      category: 'hot-coffee',
      price: 85000,
      description: '',
      ingredients: '',
      image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      prepTime: 5,
      isPopular: false,
      isSpecial: false,
      isAvailable: true,
    });
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      enName: item.enName,
      category: item.category,
      price: item.price,
      description: item.description,
      ingredients: item.ingredients ? item.ingredients.join('، ') : '',
      image: item.image,
      prepTime: item.prepTime,
      isPopular: !!item.isPopular,
      isSpecial: !!item.isSpecial,
      isAvailable: item.isAvailable,
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      enName: formData.enName,
      category: formData.category,
      price: Number(formData.price),
      description: formData.description,
      ingredients: formData.ingredients.split('،').map((s) => s.trim()).filter(Boolean),
      image: formData.image,
      prepTime: Number(formData.prepTime),
      isPopular: formData.isPopular,
      isSpecial: formData.isSpecial,
      isAvailable: formData.isAvailable,
    };

    if (editingItem) {
      await onUpdateItem(editingItem.id, payload);
    } else {
      await onAddItem(payload);
    }
    setIsItemModalOpen(false);
  };

  // Colors for Category Pie Chart
  const CATEGORY_COLORS = ['#f59e0b', '#0ea5e9', '#ec4899', '#10b981', '#8b5cf6', '#f97316'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Admin Header Bar */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-amber-500 text-stone-950 font-black text-xs">
              پنل مدیریت P CAFE
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>استریم زنده و همگام‌سازی لحظه‌ای گوشی مشتریان</span>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            داشبورد مانیتورینگ سفارش‌ها و گزارش مالی
          </h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              isSoundEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-stone-800 text-stone-400 border-stone-700'
            }`}
            title="صدای اعلان سفارش جدید"
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">اعلان صوتی</span>
          </button>

          <button
            onClick={() => {
              onRefreshOrders();
              onRefreshMenu();
              fetchStats();
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>بروزرسانی داده‌ها</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-stone-800 scrollbar-none">
        <button
          onClick={() => setActiveTab('live-orders')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'live-orders'
              ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/25'
              : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>سفارشات زنده کافه</span>
          {activeOrdersCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-stone-950 text-amber-400 text-[11px] font-black">
              {toPersianDigits(activeOrdersCount)} در صف
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/25'
              : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>گزارشات و نمودارهای زنده</span>
        </button>

        <button
          onClick={() => setActiveTab('menu-management')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'menu-management'
              ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/25'
              : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>مدیریت آیتم‌های منو</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram-settings')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'telegram-settings'
              ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/25'
              : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>اتصال تلگرام و دیتابیس</span>
        </button>
      </div>

      {/* TAB 1: LIVE ORDERS */}
      {activeTab === 'live-orders' && (
        <div className="space-y-6">
          {/* Status Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5 bg-stone-900 p-1.5 rounded-2xl border border-stone-800 overflow-x-auto">
              {[
                { key: 'all', label: 'همه سفارش‌ها' },
                { key: 'pending', label: 'در انتظار تایید' },
                { key: 'preparing', label: 'در حال آماده‌سازی' },
                { key: 'ready', label: 'آماده تحویل' },
                { key: 'completed', label: 'تسویه و تکمیل' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setOrderFilter(f.key as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    orderFilter === f.key
                      ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400">
                نمایش {toPersianDigits(filteredOrders.length)} سفارش
              </span>
              {orders.length > 0 && (
                <button
                  onClick={handleOpenClearModal}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="پاکسازی تمام سفارش‌های جاری و تستی"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>پاکسازی همه</span>
                </button>
              )}
            </div>
          </div>

          {/* Orders Cards Grid */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-stone-900/40 rounded-3xl border border-stone-800 p-8">
              <Coffee className="w-12 h-12 text-stone-600 mx-auto mb-3" />
              <h4 className="text-stone-300 font-bold">هیچ سفارشی در این وضعیت وجود ندارد</h4>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredOrders.map((order) => {
                const statusInfo = getStatusDetails(order.status);
                const isPending = order.status === 'pending';
                const isPreparing = order.status === 'preparing';
                const isReady = order.status === 'ready';

                return (
                  <motion.div
                    layout
                    key={order.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-3xl p-5 border flex flex-col justify-between transition-all bg-stone-900/90 shadow-xl ${
                      isPending
                        ? 'border-amber-500/60 shadow-amber-500/10'
                        : isPreparing
                        ? 'border-sky-500/50 shadow-sky-500/10'
                        : isReady
                        ? 'border-emerald-500/50 shadow-emerald-500/10'
                        : 'border-stone-800'
                    }`}
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-stone-800">
                        <div>
                          <span className="font-mono text-base font-black text-amber-400 block">
                            #PC-{toPersianDigits(order.orderNumber)}
                          </span>
                          <span className="text-xs text-stone-300 font-bold">
                            {order.customerName}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black border ${statusInfo.bgClass} ${statusInfo.colorClass} ${statusInfo.borderClass}`}>
                            {statusInfo.label}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {formatRelativeTime(order.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Location & Type info */}
                      <div className="flex items-center justify-between text-xs text-stone-300 mb-3 bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/80">
                        <span className="font-bold">
                          {order.orderType === 'dine-in'
                            ? `🪑 میز شماره ${toPersianDigits(order.tableNumber || 1)} (سالن)`
                            : '🛍️ سفارش بیرون‌بر'}
                        </span>
                        {order.customerPhone && (
                          <span className="font-mono text-[11px] text-stone-400" dir="ltr">
                            {order.customerPhone}
                          </span>
                        )}
                      </div>

                      {/* Items list */}
                      <div className="space-y-2 mb-4">
                        {order.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="text-xs p-2 rounded-xl bg-stone-950/40 border border-stone-800/60 flex items-start justify-between"
                          >
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{it.name}</span>
                                <span className="text-amber-400 font-mono font-bold">
                                  × {toPersianDigits(it.quantity)}
                                </span>
                              </div>
                              {it.options && (
                                <div className="text-[10px] text-stone-400 mt-0.5">
                                  {[
                                    it.options.milk ? `شیر: ${it.options.milk}` : null,
                                    it.options.sugar ? `شکر: ${it.options.sugar}` : null,
                                    it.options.extraShot ? `شات اضافه` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' - ')}
                                </div>
                              )}
                              {it.specialNote && (
                                <div className="text-[10px] text-amber-300/80 italic mt-0.5">
                                  "{it.specialNote}"
                                </div>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-stone-300">
                              {formatPriceToman(it.price * it.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-500/20 p-2.5 rounded-xl mb-3">
                          <b>یادداشت سفارش:</b> {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Total Price & Action Workflow Buttons */}
                    <div className="pt-3 border-t border-stone-800 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-400">مبلغ کل فاکتور:</span>
                        <span className="text-sm font-black text-amber-400 font-mono">
                          {formatPriceToman(order.totalPrice)}
                        </span>
                      </div>

                      {/* Quick Status Advance Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        {isPending && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                            className="col-span-2 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
                          >
                            <Coffee className="w-4 h-4" />
                            <span>تایید و ارسال به باریستا</span>
                          </button>
                        )}

                        {isPreparing && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'ready')}
                            className="col-span-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
                          >
                            <Bell className="w-4 h-4" />
                            <span>آماده شد / سرو روی میز</span>
                          </button>
                        )}

                        {isReady && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'completed')}
                            className="col-span-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تسویه و تحویل نهایی</span>
                          </button>
                        )}

                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'cancelled')}
                            className="py-1.5 rounded-xl bg-stone-800 hover:bg-rose-950 hover:text-rose-400 text-stone-400 text-[11px] font-bold border border-stone-700/60 transition-colors col-span-2"
                          >
                            لغو سفارش
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE ANALYTICS & REPORTS */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* Time Filter Pills */}
          <div className="flex items-center justify-between flex-wrap gap-4 bg-stone-900 p-4 rounded-3xl border border-stone-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-sm text-white">بازه زمانی گزارش:</span>
            </div>

            <div className="flex items-center gap-2">
              {[
                { key: 'today', label: 'گزارش امروز (روزانه)' },
                { key: 'weekly', label: 'هفته جاری (هفتگی)' },
                { key: 'monthly', label: 'ماه جاری (ماهانه)' },
                { key: 'yearly', label: 'سال جاری (سالانه)' },
              ].map((tf) => (
                <button
                  key={tf.key}
                  onClick={() => setTimeFilter(tf.key as TimeFilter)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    timeFilter === tf.key
                      ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Revenue */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-stone-400 font-bold">
                  {timeFilter === 'today'
                    ? 'درآمد امروز'
                    : timeFilter === 'weekly'
                    ? 'درآمد هفته جاری'
                    : timeFilter === 'monthly'
                    ? 'درآمد ماه جاری'
                    : 'درآمد کل سال'}
                </span>
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono mb-1">
                {formatPriceToman(
                  timeFilter === 'today'
                    ? statsData?.summary?.todayRevenue || 0
                    : timeFilter === 'weekly'
                    ? statsData?.summary?.weeklyRevenue || 0
                    : timeFilter === 'monthly'
                    ? statsData?.summary?.monthlyRevenue || 0
                    : statsData?.summary?.yearlyRevenue || statsData?.summary?.totalRevenue || 0
                )}
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>رشد +۱۴.۲٪ نسبت به دوره قبل</span>
              </div>
            </div>

            {/* Card 2: Orders Count */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-stone-400 font-bold">تعداد کل فاکتورها</span>
                <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-white font-mono mb-1">
                {toPersianDigits(
                  timeFilter === 'today'
                    ? statsData?.summary?.todayOrdersCount || orders.length
                    : statsData?.summary?.totalOrders || orders.length
                )}{' '}
                <span className="text-sm font-normal text-stone-400">سفارش</span>
              </div>
              <div className="text-[11px] text-stone-400">
                {toPersianDigits(activeOrdersCount)} سفارش فعال در کافه
              </div>
            </div>

            {/* Card 3: Average Order Value */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-stone-400 font-bold">میانگین ارزش هر سفارش</span>
                <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-300 font-mono mb-1">
                {formatPriceToman(statsData?.summary?.avgOrderValue || 115000)}
              </div>
              <div className="text-[11px] text-stone-400">ارزش میانگین هر میز کافه</div>
            </div>

            {/* Card 4: Peak Hour */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-stone-400 font-bold">ساعت اوج شلوغی کافه</span>
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-300 font-mono mb-1" dir="ltr">
                18:00 - 21:00
              </div>
              <div className="text-[11px] text-emerald-400/90">بیشترین حجم سفارشات عصرگاهی</div>
            </div>
          </div>

          {/* Charts Section: Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Revenue Trend (2 cols) */}
            <div className="lg:col-span-2 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-white">
                    نمودار روند فروش و درآمد کافه (زنده)
                  </h3>
                  <p className="text-xs text-stone-400">
                    تحلیل درآمد ثبت شده بر اساس فاکتورهای واقعی
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                  تومان
                </span>
              </div>

              <div className="h-72 w-full pt-4" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={
                      timeFilter === 'monthly' || timeFilter === 'yearly'
                        ? statsData?.monthlyBreakdown || []
                        : statsData?.dailyBreakdown || []
                    }
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                    <XAxis
                      dataKey={timeFilter === 'monthly' || timeFilter === 'yearly' ? 'month' : 'dayName'}
                      stroke="#78716c"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="#78716c"
                      fontSize={11}
                      tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1c1917',
                        borderColor: '#44403c',
                        borderRadius: '16px',
                        color: '#fff',
                        fontFamily: 'Vazirmatn',
                      }}
                      formatter={(value: any) => [formatPriceToman(Number(value)), 'درآمد']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Top Selling Items (1 col) */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="font-black text-base text-white mb-1">
                پرفروش‌ترین آیتم‌های منو
              </h3>
              <p className="text-xs text-stone-400 mb-4">
                بیشترین تعداد سفارش مشتریان
              </p>

              <div className="space-y-4">
                {(statsData?.topItems || []).slice(0, 5).map((it: any, idx: number) => {
                  const maxCount = statsData.topItems[0]?.count || 1;
                  const percent = Math.round((it.count / maxCount) * 100);

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-200 truncate max-w-[170px]">
                          {idx + 1}. {it.name}
                        </span>
                        <span className="font-mono text-amber-400 font-bold">
                          {toPersianDigits(it.count)} عدد
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Charts Section: Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Peak Chart */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="font-black text-base text-white">
                توزیع سفارشات در ساعات مختلف شبانه‌روز
              </h3>
              <p className="text-xs text-stone-400">
                بررسی ساعات شلوغی و خلوتی کافه (۸ صبح تا ۱۱ شب)
              </p>

              <div className="h-64 w-full pt-4" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData?.hourlyDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                    <XAxis dataKey="hour" stroke="#78716c" fontSize={10} />
                    <YAxis stroke="#78716c" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1c1917',
                        borderColor: '#44403c',
                        borderRadius: '16px',
                        color: '#fff',
                        fontFamily: 'Vazirmatn',
                      }}
                      formatter={(val: any) => [`${toPersianDigits(val)} سفارش`, 'تعداد سفارشات']}
                    />
                    <Bar dataKey="count" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Revenue Distribution */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="font-black text-base text-white">
                سهم دسته‌بندی‌ها از فروش کل
              </h3>
              <p className="text-xs text-stone-400">
                توزیع درآمد بین بار گرم، بار سرد، کیک و دسر و سایر بخش‌ها
              </p>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CATEGORIES.map((cat, i) => ({
                        name: cat.name,
                        value: (i + 1) * 15 + (i === 0 ? 30 : 0),
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {CATEGORIES.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1c1917',
                        borderColor: '#44403c',
                        borderRadius: '16px',
                        color: '#fff',
                        fontFamily: 'Vazirmatn',
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'Vazirmatn', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MENU MANAGEMENT */}
      {activeTab === 'menu-management' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-stone-900 p-4 rounded-3xl border border-stone-800">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="جستجوی نام آیتم، قیمت یا ترکیبات..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-stone-950 border border-stone-800 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={openCreateItem}
                className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن آیتم جدید به منو</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
              }`}
            >
              همه دسته‌ها ({toPersianDigits(menuItems.length)})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Items Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-stone-950 text-stone-400 border-b border-stone-800">
                  <tr>
                    <th className="p-4">تصویر و عنوان</th>
                    <th className="p-4">دسته‌بندی</th>
                    <th className="p-4">قیمت</th>
                    <th className="p-4">زمان آماده‌سازی</th>
                    <th className="p-4">وضعیت موجودی</th>
                    <th className="p-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/80">
                  {filteredMenuItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-800/40 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="font-bold text-white text-sm">{item.name}</div>
                          <div className="text-[11px] text-stone-400 font-mono">{item.enName}</div>
                        </div>
                      </td>
                      <td className="p-4 text-stone-300">
                        {CATEGORIES.find((c) => c.id === item.category)?.name || item.category}
                      </td>
                      <td className="p-4 font-mono font-bold text-amber-400">
                        {formatPriceToman(item.price)}
                      </td>
                      <td className="p-4 font-mono text-stone-300">
                        {toPersianDigits(item.prepTime)} دقیقه
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => onToggleItemAvailability(item.id, item.isAvailable)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            item.isAvailable
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                          }`}
                        >
                          {item.isAvailable ? 'موجود است' : 'به اتمام رسید (ناموجود)'}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditItem(item)}
                            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                            title="ویرایش اطلاعات و قیمت"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="p-2 rounded-xl bg-stone-800 hover:bg-rose-900/60 text-stone-400 hover:text-rose-400 transition-colors"
                            title="حذف از منو"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TELEGRAM & DATABASE SETTINGS */}
      {activeTab === 'telegram-settings' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">
                  وضعیت اتصال به ربات و کانال تلگرام
                </h3>
                <p className="text-xs text-stone-400">
                  تمام سفارش‌ها، تغییرات وضعیت و پشتیبان‌گیری دیتابیس به صورت خودکار به کانال تلگرام مخابره می‌شود.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-stone-800">
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="text-xs text-stone-400">آیدی کانال دیتابیس تلگرام:</div>
                <div className="font-mono text-base font-bold text-amber-400 dir-ltr flex items-center justify-between">
                  <span>@pcafedata</span>
                  <a
                    href="https://t.me/pcafedata"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-400 hover:underline font-vazir"
                  >
                    مشاهده کانال در تلگرام
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="text-xs text-stone-400">توکن فعال ربات ادمین (Bot Token):</div>
                <div className="font-mono text-xs text-stone-300 dir-ltr break-all bg-stone-900 p-2.5 rounded-xl">
                  8632037639:AAFZm5TzaEj5Dy5o1EK2Ve0Z5UXjEsRtHx8
                </div>
              </div>

              {telegramStatus && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-stone-950 border border-amber-500/40 text-xs text-stone-200"
                >
                  {telegramStatus}
                </motion.div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={testTelegram}
                  disabled={isTestingTg}
                  className="py-3 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>تست اتصال کانال</span>
                </button>

                <button
                  onClick={backupToTelegram}
                  disabled={isTestingTg}
                  className="py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>بکاپ دیتابیس در تلگرام</span>
                </button>

                <button
                  onClick={restoreFromTelegram}
                  disabled={isTestingTg}
                  className="py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>بازیابی از تلگرام</span>
                </button>
              </div>

              {/* Clear Orders Database Card */}
              <div className="pt-4 mt-4 border-t border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-stone-200">پاکسازی تاریخچه سفارش‌های ثبت شده</h4>
                  <p className="text-[11px] text-stone-400">حذف تمامی سفارش‌های تستی و جاری از لیست پیگیری و پنل مدیریت</p>
                </div>
                <button
                  onClick={handleOpenClearModal}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all whitespace-nowrap"
                >
                  حذف و پاکسازی تمام سفارش‌ها
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Create / Edit Modal */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsItemModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl z-10 my-8"
            >
              <h3 className="text-xl font-black text-white mb-4">
                {editingItem ? 'ویرایش آیتم منو' : 'افزودن آیتم جدید به منو'}
              </h3>

              <form onSubmit={handleSaveItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-400 block mb-1">نام فارسی:</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثلاً: لاته زعفرانی"
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-400 block mb-1">نام انگلیسی:</label>
                    <input
                      required
                      type="text"
                      value={formData.enName}
                      onChange={(e) => setFormData({ ...formData, enName: e.target.value })}
                      placeholder="e.g. Saffron Latte"
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-400 block mb-1">دسته‌بندی:</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as CategoryId })}
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-400 block mb-1">قیمت (تومان):</label>
                    <input
                      required
                      type="number"
                      step={1000}
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1">آدرس تصویر (Image URL):</label>
                  <input
                    required
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none font-mono dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1">توضیحات آیتم:</label>
                  <textarea
                    required
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1">
                    ترکیبات (با کاما یا ویرگول فارسی جدا کنید):
                  </label>
                  <input
                    type="text"
                    value={formData.ingredients}
                    onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                    placeholder="شیر، اسپرسو، پودر کاکائو..."
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPopular}
                      onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                      className="accent-amber-500 rounded w-4 h-4"
                    />
                    <span>محبوب و پرفروش</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isSpecial}
                      onChange={(e) => setFormData({ ...formData, isSpecial: e.target.checked })}
                      className="accent-amber-500 rounded w-4 h-4"
                    />
                    <span>پیشنهاد ویژه P Cafe</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setIsItemModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-lg shadow-amber-500/20"
                  >
                    ذخیره تغییرات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Clear All Orders Confirmation Modal */}
        {isClearOrdersModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isClearingOrders && setIsClearOrdersModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="relative w-full max-w-md bg-stone-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl z-10 space-y-5 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
                <Trash2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-white">
                  آیا از پاکسازی تمام سفارش‌ها اطمینان دارید؟
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  تمامی سفارش‌های ثبت‌شده (جاری و تستی) به طور کامل از پنل مدیریت، لیست پیگیری مشتریان و دیتابیس پاک خواهند شد. این عملیات غیرقابل بازگشت است.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isClearingOrders}
                  onClick={() => setIsClearOrdersModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={isClearingOrders}
                  onClick={handleConfirmClearOrders}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isClearingOrders ? (
                    <span>در حال پاکسازی...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>بله، پاکسازی کن</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

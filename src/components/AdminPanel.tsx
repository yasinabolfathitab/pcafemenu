import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateAnalytics } from '../utils/analytics';
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
  Database,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  Sliders,
  LogOut,
  Volume2,
  VolumeX,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  FileText,
  Check,
  X,
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
  supabase,
  isSupabaseConfigured,
  SUPABASE_URL,
} from '../supabase';
import { playNewOrderChime } from '../utils/audio';
import {
  formatPriceToman,
  formatRelativeTime,
  formatPersianTimeOnly,
  toPersianDigits,
  getStatusDetails,
} from '../utils/formatters';
import { exportOrdersToExcel, filterOrdersByTime } from '../utils/excelExport';

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
  onResetDefaultMenu?: () => Promise<void>;
  onLogout: () => void;
}

type AdminTab = 'live-orders' | 'analytics' | 'menu-management' | 'database-settings';
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
  onResetDefaultMenu,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('live-orders');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [isWebSocketActive, setIsWebSocketActive] = useState<boolean>(false);

  // Step 3 (Real-time): Supabase WebSockets live subscription for Cafe Admin Panel
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setIsWebSocketActive(false);
      return;
    }

    console.log('🔌 Connecting Admin Panel to Supabase WebSocket channel (public:orders)...');
    const channel = supabase
      .channel('admin-panel-orders-websocket')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('⚡ [AdminPanel WebSockets] Real-time event received:', payload.eventType);
          // Instant sync without page reload
          onRefreshOrders();

          if (payload.eventType === 'INSERT') {
            if (isSoundEnabled) {
              playNewOrderChime();
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsWebSocketActive(true);
          console.log('🟢 Admin Panel Supabase WebSockets active and listening');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsWebSocketActive(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSoundEnabled, onRefreshOrders]);

  // Clear orders confirmation modal state
  const [isClearOrdersModalOpen, setIsClearOrdersModalOpen] = useState<boolean>(false);
  const [isClearingOrders, setIsClearingOrders] = useState<boolean>(false);

  // Excel export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [exportFormat, setExportFormat] = useState<'xls' | 'csv'>('xls');
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Real-time client analytics calculated directly from orders and menu catalog
  // Ensures 100% full availability on Cloudflare Pages and static serverless environments
  const clientAnalytics = useMemo(() => {
    return calculateAnalytics(orders, menuItems);
  }, [orders, menuItems]);

  // Optional server-side stats cache
  const [serverStatsData, setServerStatsData] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

  // statsData always falls back to real-time client analytics when deployed on Cloudflare Pages
  const statsData = serverStatsData || clientAnalytics;

  // Database action response feedback
  const [dbActionStatus, setDbActionStatus] = useState<string | null>(null);

  // Add / Edit Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleImageFileChange = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('لطفاً یک فایل تصویری با فرمت معتبر (JPG, PNG, WEBP) انتخاب فرمایید.');
      return;
    }
    setImageError(null);
    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Automatically resize and optimize image for fastest loading & storage
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFormData((prev) => ({ ...prev, image: compressedDataUrl }));
        } else {
          setFormData((prev) => ({ ...prev, image: event.target?.result as string }));
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => {
        setImageError('خطا در پردازش تصویر.');
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setImageError('خطا در خواندن فایل از سیستم.');
      setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
  };

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
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data && data.summary) {
            setServerStatsData(data);
          }
        }
      }
    } catch {
      // Deployed on Cloudflare Pages / static hosting:
      // Gracefully rely on real-time clientAnalytics!
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [orders]);

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
      setDbActionStatus('🗑️ تمامی سفارش‌ها با موفقیت از دیتابیس پاکسازی شدند.');
      fetchStats();
      setIsClearOrdersModalOpen(false);
    } catch (e: any) {
      setDbActionStatus(`❌ خطا در پاکسازی سفارش‌ها: ${e.message}`);
    } finally {
      setIsClearingOrders(false);
    }
  };

  const handleTriggerExport = (scope: 'filtered' | 'all' = exportScope, format: 'xls' | 'csv' = exportFormat) => {
    const targetOrders = scope === 'filtered' 
      ? filterOrdersByTime(orders, timeFilter)
      : orders;

    if (targetOrders.length === 0) {
      alert('هیچ سفارشی در این بازه زمانی برای خروجی اکسل یافت نشد.');
      return;
    }

    const timeLabels: Record<TimeFilter, string> = {
      today: 'امروز (روزانه)',
      weekly: 'هفته جاری (۷ روز اخیر)',
      monthly: 'ماه جاری (۳۰ روز اخیر)',
      yearly: 'سال جاری',
    };

    const label = scope === 'filtered' 
      ? `گزارش ${timeLabels[timeFilter]}`
      : 'آرشیو کامل تمامی فاکتورهای ثبت شده کافه';

    exportOrdersToExcel(targetOrders, {
      filterLabel: label,
      cafeName: 'کافه پی (P Cafe)',
      format,
    });

    setExportSuccessMsg(`✅ فایل ${format === 'xls' ? 'اکسل (.xls)' : 'CSV'} شامل ${toPersianDigits(targetOrders.length)} سفارش با موفقیت دانلود شد.`);
    setTimeout(() => setExportSuccessMsg(null), 4500);
    setIsExportModalOpen(false);
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
    setImageError(null);
    setIsProcessingImage(false);
    setEditingItem(null);
    setFormData({
      name: '',
      enName: '',
      category: 'hot-coffee',
      price: 85000,
      description: '',
      ingredients: '',
      image: '',
      prepTime: 5,
      isPopular: false,
      isSpecial: false,
      isAvailable: true,
    });
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setImageError(null);
    setIsProcessingImage(false);
    setEditingItem(item);
    setFormData({
      name: item.name,
      enName: item.enName,
      category: item.category,
      price: item.price,
      description: item.description,
      ingredients: item.ingredients ? item.ingredients.join('، ') : '',
      image: item.image || '',
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
      image: formData.image ? formData.image.trim() : '',
      prepTime: Number(formData.prepTime) || 5,
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
            {isSupabaseConfigured ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <span className={`w-2 h-2 rounded-full bg-emerald-400 ${isWebSocketActive ? 'animate-ping' : ''}`} />
                <span>اتصال وب‌سوکت Supabase (Real-time)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>حالت محلی Standalone / آماده اتصال به Supabase</span>
              </div>
            )}
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
          onClick={() => setActiveTab('database-settings')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'database-settings'
              ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/25'
              : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>پایگاه داده و اتصالات</span>
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
          {/* Time Filter & Export Bar */}
          <div className="flex items-center justify-between flex-wrap gap-4 bg-stone-900 p-4 rounded-3xl border border-stone-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-sm text-white">بازه زمانی گزارش:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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

              {/* Excel Export Button */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 border border-emerald-500/40 transition-all active:scale-95 cursor-pointer ml-auto sm:ml-0"
                title="دریافت فایل اکسل فاکتورها و گزارشات"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>خروجی اکسل (Excel)</span>
              </button>
            </div>
          </div>

          {/* Export Success Toast Notification */}
          {exportSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{exportSuccessMsg}</span>
              </div>
              <button
                onClick={() => setExportSuccessMsg(null)}
                className="text-stone-400 hover:text-stone-200 text-xs"
              >
                بستن ✕
              </button>
            </motion.div>
          )}

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

              <div className="h-72 min-h-[280px] w-full pt-4" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minHeight={250}>
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

              <div className="h-64 min-h-[250px] w-full pt-4" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minHeight={220}>
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

              <div className="h-64 min-h-[250px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                  <PieChart>
                    <Pie
                      data={
                        statsData?.categoryDistribution ||
                        CATEGORIES.map((cat, i) => ({
                          name: cat.name,
                          value: (i + 1) * 15 + (i === 0 ? 30 : 0),
                        }))
                      }
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

          {/* Excel Export & Management Card */}
          <div className="bg-gradient-to-r from-stone-900 via-stone-900 to-emerald-950/30 border border-emerald-500/30 rounded-3xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-base text-white">
                    خروجی اکسل و گزارش آماری سفارشات کافه
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    فرمت رسمی Microsoft Excel &amp; CSV
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed max-w-2xl">
                  دریافت مستقیم فایل اکسل راست‌چین (RTL) فاکتورها شامل شماره فاکتور، تاریخ و ساعت، مشخصات مشتری، شماره میز، جزئیات کامل اقلام و افزودنی‌ها، قیمت‌ها، مبالغ و وضعیت‌ها، آماده برای نرم‌افزارهای حسابداری و بایگانی.
                </p>
                <div className="flex items-center gap-4 pt-1 text-[11px] text-stone-400">
                  <span>📊 تعداد فاکتورهای کل: <strong className="text-amber-400 font-mono">{toPersianDigits(orders.length)}</strong></span>
                  <span>💰 مجموع کل فروش: <strong className="text-emerald-400 font-mono">{formatPriceToman(orders.reduce((acc, o) => o.status !== 'cancelled' ? acc + o.totalPrice : acc, 0))}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap shrink-0">
              <button
                onClick={() => {
                  setExportScope('filtered');
                  setExportFormat('xls');
                  handleTriggerExport('filtered', 'xls');
                }}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  دانلود اکسل {timeFilter === 'today' ? 'امروز' : timeFilter === 'weekly' ? 'هفته جاری' : timeFilter === 'monthly' ? 'ماه جاری' : 'سال جاری'}
                </span>
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700 transition-all cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>سفارشی‌سازی خروجی</span>
              </button>
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

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {onResetDefaultMenu && (
                <button
                  onClick={async () => {
                    if (window.confirm('آیا مایلید تمام آیتم‌های منوی کافه (اسپرسو، بار گرم، سرد، کیک‌ها، ماکتل و ...) بازیابی و با پایگاه داده همگام‌سازی شوند؟')) {
                      await onResetDefaultMenu();
                    }
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs flex items-center gap-2 border border-stone-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>بازیابی و همگام‌سازی منوی کامل کافه</span>
                </button>
              )}
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
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover border border-stone-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <button
                            onClick={() => openEditItem(item)}
                            className="w-12 h-12 rounded-xl bg-amber-500/10 border border-dashed border-amber-500/40 hover:bg-amber-500/20 text-amber-400 flex flex-col items-center justify-center text-[9px] font-bold gap-0.5 transition-all shrink-0 group"
                            title="کلیک برای بارگذاری تصویر"
                          >
                            <Upload className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span>+عکس</span>
                          </button>
                        )}
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

      {/* TAB 4: SUPABASE DATABASE SETTINGS */}
      {activeTab === 'database-settings' && (
        <div className="space-y-6 max-w-3xl">
          {/* Supabase Database & Realtime WebSocket Status Card */}
          <div className="bg-stone-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl space-y-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <RefreshCw className={`w-6 h-6 ${isWebSocketActive ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-white">
                    پایگاه داده Supabase و وب‌سوکت آنی
                  </h3>
                  {isSupabaseConfigured ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                      متصل (Connected)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold border border-amber-500/30">
                      حالت Standalone / لوکال
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400">
                  مدیریت ذخیره‌سازی داده‌های سفارش و دریافت لحظه‌ای رویدادها از جدول orders با وب‌سوکت سوپابیس
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-stone-800 text-xs">
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">وضعیت اتصال WebSockets:</span>
                <span className="font-bold flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isWebSocketActive ? 'bg-emerald-400 animate-ping' : 'bg-stone-500'}`} />
                  <span className={isWebSocketActive ? 'text-emerald-400' : 'text-stone-400'}>
                    {isWebSocketActive ? 'کانال Realtime فعال و شنونده تغییرات' : 'در انتظار اتصال / حالت آفلاین'}
                  </span>
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">آدرس پروژه (Project URL):</span>
                <span className="font-mono text-stone-200 dir-ltr font-bold">
                  {SUPABASE_URL ? `${SUPABASE_URL.slice(0, 25)}...` : 'تنظیم نشده (پیش‌فرض لوکال)'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">جداول مرتبط دیتابیس:</span>
                <span className="font-mono text-amber-400 font-bold dir-ltr">
                  orders, menu_items
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">تعداد سفارشات در حافظه جاری:</span>
                <span className="text-stone-200 font-bold">
                  {toPersianDigits(orders.length)} سفارش
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">تعداد اقلام ثبت‌شده در منو:</span>
                <span className="text-stone-200 font-bold">
                  {toPersianDigits(menuItems.length)} آیتم
                </span>
              </div>
            </div>

            {dbActionStatus && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-stone-950 border border-amber-500/40 text-xs text-stone-200"
              >
                {dbActionStatus}
              </motion.div>
            )}

            <div className="pt-4 border-t border-stone-800 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  onRefreshOrders();
                  onRefreshMenu();
                  fetchStats();
                  setDbActionStatus('🔄 داده‌های سفارشات و منو مجدداً با پایگاه داده همگام‌سازی شدند.');
                }}
                className="py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>همگام‌سازی و بازخوانی مجدد اطلاعات</span>
              </button>
            </div>
          </div>

          {/* Danger Zone: Clear Orders Database Card */}
          <div className="bg-stone-900 border border-rose-500/20 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-200">پاکسازی تاریخچه سفارش‌های ثبت شده</h4>
                <p className="text-xs text-stone-400">حذف تمامی سفارش‌های تستی و جاری از لیست پیگیری و پایگاه داده</p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleOpenClearModal}
                className="px-5 py-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all whitespace-nowrap"
              >
                حذف و پاکسازی تمام سفارش‌ها
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Create / Edit Modal */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsItemModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[88vh] bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden"
            >
              {/* Modal Fixed Header */}
              <div className="p-4 sm:p-5 border-b border-stone-800/90 flex items-center justify-between bg-stone-900/95 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      {editingItem ? 'ویرایش آیتم منو' : 'افزودن آیتم جدید به منو'}
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      {editingItem ? editingItem.name : 'مشخصات، قیمت و تصویر محصول'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-colors text-sm"
                  title="بستن پنجره"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form with Scrollable Content Body and Sticky Footer */}
              <form onSubmit={handleSaveItem} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
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

                {/* Image Section: Direct File Upload & URL */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-stone-300 font-bold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>تصویر آیتم منو:</span>
                    </label>
                    <span className="text-[11px] text-stone-400">
                      (آپلود مستقیم فایل یا لینک اینترنتی)
                    </span>
                  </div>

                  {/* Drag & Drop / File Upload Box */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingImage(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingImage(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingImage(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleImageFileChange(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                      isDraggingImage
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-stone-800 hover:border-amber-500/50 bg-stone-900/50 hover:bg-stone-900'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/gif"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageFileChange(e.target.files[0]);
                        }
                      }}
                    />

                    {isProcessingImage ? (
                      <div className="flex items-center gap-2 py-2 text-amber-400 text-xs font-bold">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>در حال بهینه‌سازی و ذخیره تصویر...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-200">
                            کلیک برای انتخاب عکس از سیستم یا گوشی
                          </p>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            یا عکس را بکشید و در این کادر رها کنید (PNG, JPG, WebP)
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {imageError && (
                    <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-xl border border-rose-900/50">
                      {imageError}
                    </p>
                  )}

                  {/* Or Enter Image URL */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-stone-400">یا نشانی مستقیم تصویر در اینترنت (Image URL):</span>
                      {formData.image && formData.image.startsWith('data:') && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          عکس از سیستم آپلود شده است ✓
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.image.startsWith('data:') ? 'عکس بارگذاری شده از سیستم (Base64 Data)' : formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white focus:border-amber-500 focus:outline-none font-mono dir-ltr text-right"
                    />
                  </div>

                  {/* Live Image Preview */}
                  {formData.image && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-900/90 border border-stone-800">
                      <img
                        src={formData.image}
                        alt="پیش‌نمایش تصویر"
                        className="w-14 h-14 rounded-xl object-cover border border-stone-700 shadow-md"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0 text-right">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>تصویر انتخاب شده و فعال است</span>
                        </div>
                        <p className="text-[11px] text-stone-400 truncate mt-0.5 dir-ltr text-right">
                          {formData.image.startsWith('data:') ? 'عکس آپلود شده (فشرده و بهینه‌شده)' : formData.image}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, image: '' });
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-2 rounded-xl bg-stone-800 hover:bg-rose-950 hover:text-rose-400 text-stone-400 transition-colors"
                        title="حذف تصویر"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
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
                </div>

                {/* Modal Fixed Footer */}
                <div className="p-3.5 sm:px-6 sm:py-4 border-t border-stone-800 bg-stone-900/95 backdrop-blur-md flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsItemModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all"
                  >
                    {editingItem ? 'ذخیره تغییرات' : 'افزودن به منو'}
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

        {/* Excel Export Configuration Modal */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-stone-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl z-10 space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      دریافت خروجی اکسل سفارشات و فروش
                    </h3>
                    <p className="text-xs text-stone-400">
                      تنظیم محدوده فاکتورها و فرمت فایل خروجی
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Scope Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-300 block">
                  ۱. محدوده سفارشات مورد نظر برای خروجی:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportScope('filtered')}
                    className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                      exportScope === 'filtered'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950'
                        : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs">
                        بازه انتخابی فعال (
                        {timeFilter === 'today'
                          ? 'امروز'
                          : timeFilter === 'weekly'
                          ? 'هفته جاری'
                          : timeFilter === 'monthly'
                          ? 'ماه جاری'
                          : 'سال جاری'}
                        )
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          exportScope === 'filtered'
                            ? 'border-emerald-400 bg-emerald-500 text-stone-950'
                            : 'border-stone-600'
                        }`}
                      >
                        {exportScope === 'filtered' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {toPersianDigits(filterOrdersByTime(orders, timeFilter).length)} سفارش در این دوره
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope('all')}
                    className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                      exportScope === 'all'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950'
                        : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs">تمام فاکتورهای کافه</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          exportScope === 'all'
                            ? 'border-emerald-400 bg-emerald-500 text-stone-950'
                            : 'border-stone-600'
                        }`}
                      >
                        {exportScope === 'all' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {toPersianDigits(orders.length)} سفارش (کل تاریخچه)
                    </div>
                  </button>
                </div>
              </div>

              {/* Format Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-300 block">
                  ۲. فرمت فایل خروجی:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat('xls')}
                    className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                      exportFormat === 'xls'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">فایل اکسل (.xls)</div>
                      <div className="text-[11px] text-stone-400 mt-1">
                        راست‌چین خودکار، سرستون‌های رنگی، مناسب باز شدن مستقیم در Excel
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`p-4 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                      exportFormat === 'csv'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">فایل متنی (.csv)</div>
                      <div className="text-[11px] text-stone-400 mt-1">
                        کدگذاری UTF-8 با BOM، مناسب انواع نرم‌افزارهای حسابداری
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Data Preview Summary */}
              {(() => {
                const targetList =
                  exportScope === 'filtered'
                    ? filterOrdersByTime(orders, timeFilter)
                    : orders;
                const totalSum = targetList.reduce(
                  (sum, o) => (o.status !== 'cancelled' ? sum + o.totalPrice : sum),
                  0
                );
                return (
                  <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <span className="text-stone-400 block">فاکتورهای آماده خروجی:</span>
                      <strong className="text-white font-mono text-sm">
                        {toPersianDigits(targetList.length)} سفارش
                      </strong>
                    </div>
                    <div className="space-y-1 text-left">
                      <span className="text-stone-400 block">مجموع مبلغ فروش:</span>
                      <strong className="text-emerald-400 font-mono text-sm">
                        {formatPriceToman(totalSum)}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-5 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerExport(exportScope, exportFormat)}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود و ذخیره فایل اکسل</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

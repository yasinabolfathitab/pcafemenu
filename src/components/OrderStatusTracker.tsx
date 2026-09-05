import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, Coffee, Bell, CheckCircle2, RefreshCw, Send, Sparkles, ChevronRight, XCircle, Search, ArrowRight } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { formatPriceToman, formatPersianTimeOnly, formatRelativeTime, toPersianDigits, getStatusDetails } from '../utils/formatters';

interface OrderStatusTrackerProps {
  orders: Order[];
  onRefresh: () => void;
  isLoading?: boolean;
  onNavigateToMenu?: () => void;
  onLookupOrder?: (query: string) => Promise<boolean>;
}

export const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  orders,
  onRefresh,
  isLoading = false,
  onNavigateToMenu,
  onLookupOrder,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    orders.length > 0 ? orders[0].id : null
  );
  const [lookupQuery, setLookupQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (orders.length > 0) {
      if (!selectedOrderId || !orders.some((o) => o.id === selectedOrderId)) {
        setSelectedOrderId(orders[0].id);
      }
    } else {
      setSelectedOrderId(null);
    }
  }, [orders, selectedOrderId]);

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || (orders.length > 0 ? orders[0] : null);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim() || !onLookupOrder) return;
    setIsSearching(true);
    setSearchFeedback(null);
    try {
      const found = await onLookupOrder(lookupQuery.trim());
      if (found) {
        setSearchFeedback({ type: 'success', text: 'سفارش با موفقیت یافت و به لیست سفارش‌های شما افزوده شد.' });
        setLookupQuery('');
      } else {
        setSearchFeedback({ type: 'error', text: 'سفارشی با این شماره یا مشخصات یافت نشد.' });
      }
    } catch (err) {
      setSearchFeedback({ type: 'error', text: 'خطا در جستجوی سفارش.' });
    } finally {
      setIsSearching(false);
    }
  };

  const steps: { key: OrderStatus; label: string; desc: string; icon: any }[] = [
    {
      key: 'pending',
      label: 'ثبت در سامانه',
      desc: 'سفارش دریافت شد و در صف باریستا قرار گرفت',
      icon: Clock,
    },
    {
      key: 'preparing',
      label: 'در حال آماده‌سازی',
      desc: 'باریستا در حال عصاره‌گیری قهوه و آماده‌سازی آیتم‌ها است',
      icon: Coffee,
    },
    {
      key: 'ready',
      label: 'آماده تحویل',
      desc: 'سفارش آماده است؛ در حال سرو روی میز یا آماده در باجه تحویل',
      icon: Bell,
    },
    {
      key: 'completed',
      label: 'تکمیل و تحویل',
      desc: 'نوش جان! سفارش تحویل داده شد',
      icon: CheckCircle2,
    },
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'preparing': return 1;
      case 'ready': return 2;
      case 'completed': return 3;
      default: return -1;
    }
  };

  const currentStep = activeOrder ? getStepIndex(activeOrder.status) : 0;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-stone-900 to-stone-950 p-5 sm:p-6 rounded-3xl border border-stone-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              پیگیری اختصاصی سفارش شما
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-400">
            مشاهده لحظه‌ای وضعیت آماده‌سازی سفارشات ثبت شده توسط شما
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {orders.length > 0 && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>بروزرسانی وضعیت</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Order Lookup Form */}
      <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="جستجوی سفارش با شماره فاکتور (مثال: PC-1001 یا 1001 یا شماره همراه)"
              className="w-full bg-stone-950 border border-stone-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !lookupQuery.trim()}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>یافتن سفارش</span>
          </button>
        </form>
        {searchFeedback && (
          <p className={`text-xs mt-2 px-1 ${searchFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {searchFeedback.text}
          </p>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-stone-900/40 rounded-3xl border border-stone-800/80 p-8">
          <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700/60 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-lg">
            <Coffee className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white mb-2">
            شما هنوز سفارشی در این دستگاه ثبت نکرده‌اید
          </h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto mb-6 leading-relaxed">
            سفارش‌های هر مشتری به طور اختصاصی نگهداری می‌شود. می‌توانید از بخش منو سفارش جدید ثبت کنید یا با کادر بالا شماره فاکتور خود را جستجو نمایید.
          </p>
          {onNavigateToMenu && (
            <button
              onClick={onNavigateToMenu}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <span>مشاهده منوی کافه و ثبت سفارش</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Selector List (Left Column) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-stone-400 px-1">سفارش‌های ثبت شده شما:</h3>
            <div className="space-y-2">
              {orders.map((ord) => {
                const statusInfo = getStatusDetails(ord.status);
                const isSelected = ord.id === activeOrder?.id;

                return (
                  <motion.div
                    key={ord.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-stone-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
                        : 'bg-stone-950/60 border-stone-800/80 hover:bg-stone-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-black text-amber-400">
                        #PC-{toPersianDigits(ord.orderNumber)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusInfo.bgClass} ${statusInfo.colorClass} ${statusInfo.borderClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-300">
                      <span>
                        {ord.orderType === 'dine-in' ? `میز ${toPersianDigits(ord.tableNumber || 1)}` : 'بیرون‌بر'}
                      </span>
                      <span className="font-mono text-stone-400">
                        {formatRelativeTime(ord.createdAt)}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-bold text-white font-mono flex items-center justify-between">
                      <span className="text-stone-400 text-[11px] font-normal">
                        {toPersianDigits(ord.items.length)} قلم
                      </span>
                      <span>{formatPriceToman(ord.totalPrice)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Active Order 3D Progress Details (Right Column) */}
          {activeOrder && (
            <div className="lg:col-span-2 space-y-6">
              {/* Order Status Hero Card */}
              <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-stone-800">
                  <div>
                    <span className="text-xs text-stone-400 block mb-1">شناسه فاکتور اختصاصی:</span>
                    <h3 className="text-2xl font-black text-amber-400 font-mono tracking-wider">
                      #PC-{toPersianDigits(activeOrder.orderNumber)}
                    </h3>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs px-3 py-1 rounded-full bg-stone-800 text-stone-300 font-medium">
                      {activeOrder.orderType === 'dine-in'
                        ? `🪑 میز شماره ${toPersianDigits(activeOrder.tableNumber || 1)}`
                        : '🛍️ سفارش بیرون‌بر'}
                    </span>
                    <span className="text-[11px] text-stone-500">
                      ثبت شده در: {formatPersianTimeOnly(activeOrder.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="py-8">
                  {activeOrder.status === 'cancelled' ? (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
                      <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm">این سفارش لغو گردید</h4>
                        <p className="text-xs text-rose-200/80">
                          برای هماهنگی یا ثبت سفارش جدید لطفاً با باریستا هماهنگ کنید.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Step Progress Bar Track */}
                      <div className="absolute top-6 right-8 left-8 h-1 bg-stone-800 -z-0">
                        <div
                          className="h-full bg-gradient-to-l from-amber-400 to-amber-600 transition-all duration-700"
                          style={{
                            width: `${(currentStep / (steps.length - 1)) * 100}%`,
                          }}
                        />
                      </div>

                      {/* Steps Grid */}
                      <div className="grid grid-cols-4 gap-2 relative z-10">
                        {steps.map((step, idx) => {
                          const isDone = idx <= currentStep;
                          const isCurrent = idx === currentStep;
                          const StepIcon = step.icon;

                          return (
                            <div key={step.key} className="flex flex-col items-center text-center">
                              <motion.div
                                animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 transition-all shadow-lg ${
                                  isDone
                                    ? 'bg-amber-500 text-stone-950 shadow-amber-500/30'
                                    : 'bg-stone-800 text-stone-500 border border-stone-700'
                                }`}
                              >
                                <StepIcon className="w-5 h-5" />
                              </motion.div>
                              <h5
                                className={`text-xs font-bold leading-tight ${
                                  isDone ? 'text-white' : 'text-stone-500'
                                }`}
                              >
                                {step.label}
                              </h5>
                              <p className="text-[10px] text-stone-400 mt-1 hidden sm:block max-w-[110px]">
                                {step.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Confirmation Badge */}
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/20 flex items-center justify-between text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>سفارش با موفقیت ثبت شد و به باریستای کافه تحویل گردید.</span>
                  </div>
                  <span className="text-stone-400 text-[11px] font-mono">
                    شماره فاکتور: #PC-{activeOrder.orderNumber}
                  </span>
                </div>
              </div>

              {/* Order Items Breakdown */}
              <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
                <h4 className="text-sm font-bold text-stone-300">جزئیات فاکتور و اقلام:</h4>
                <div className="divide-y divide-stone-800">
                  {activeOrder.items.map((it, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{it.name}</span>
                          <span className="text-amber-400 font-bold font-mono">
                            × {toPersianDigits(it.quantity)}
                          </span>
                        </div>
                        {it.options && (
                          <div className="text-[11px] text-stone-400 mt-0.5">
                            {[
                              it.options.milk ? `شیر: ${it.options.milk}` : null,
                              it.options.sugar ? `شکر: ${it.options.sugar}` : null,
                              it.options.extraShot ? `شات دوبل اضافه` : null,
                            ]
                              .filter(Boolean)
                              .join(' | ')}
                          </div>
                        )}
                        {it.specialNote && (
                          <div className="text-[11px] text-amber-300/80 italic mt-0.5">
                            یادداشت: {it.specialNote}
                          </div>
                        )}
                      </div>
                      <span className="font-bold font-mono text-stone-200">
                        {formatPriceToman(it.price * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="pt-4 border-t border-stone-800 flex items-center justify-between text-sm font-black">
                  <span className="text-stone-400">مبلغ کل فاکتور:</span>
                  <span className="text-amber-400 font-mono text-base">
                    {formatPriceToman(activeOrder.totalPrice)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

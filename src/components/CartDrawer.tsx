import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Minus, ShoppingBag, Send, Coffee, Sparkles, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartItem, Order } from '../types';
import { formatPriceToman, toPersianDigits } from '../utils/formatters';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (cartItemId: string, newQuantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}) => {
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [tableNumber, setTableNumber] = useState<number>(3);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subtotal = cartItems.reduce((acc, item) => acc + item.itemTotal, 0);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        customerName: customerName.trim() || 'مشتری گرامی',
        customerPhone: customerPhone.trim() || undefined,
        orderType,
        tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
        items: cartItems.map((ci) => ({
          menuItemId: ci.menuItem.id,
          name: ci.menuItem.name,
          price: ci.itemTotal / ci.quantity,
          quantity: ci.quantity,
          options: ci.options,
          specialNote: ci.specialNote,
        })),
        notes: notes.trim() || undefined,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'خطا در ثبت سفارش');
      }

      // Fire festive celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#38bdf8', '#10b981'],
      });

      onClearCart();
      onOrderSuccess(data.order);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'ثبت سفارش با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        />

        {/* Slide-over Panel */}
        <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="w-screen max-w-md bg-stone-900 border-r border-amber-500/20 text-stone-100 shadow-2xl flex flex-col justify-between"
          >
            {/* Header */}
            <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">سبد سفارش کافه</h3>
                  <p className="text-xs text-stone-400">
                    {toPersianDigits(cartItems.length)} آیتم انتخاب شده
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {cartItems.length > 0 && (
                  <button
                    onClick={onClearCart}
                    className="text-xs text-rose-400 hover:text-rose-300 p-2 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1"
                    title="خالی کردن سبد"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">حذف همه</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-stone-800/60 border border-stone-700/50 flex items-center justify-center text-stone-500">
                    <Coffee className="w-10 h-10 stroke-1" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-300 mb-1">سبد خرید شما خالی است</h4>
                    <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                      از منوی جذاب کافه، قهوه یا دسر دلخواه خود را انتخاب کنید تا به سبد سفارش افزوده شود.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                  >
                    مشاهده منوی کافه
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-stone-400">اقلام سفارش:</h4>
                    {cartItems.map((ci) => (
                      <motion.div
                        layout
                        key={ci.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 flex items-center gap-3"
                      >
                        <img
                          src={ci.menuItem.image}
                          alt={ci.menuItem.name}
                          className="w-14 h-14 rounded-xl object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-xs sm:text-sm text-white truncate">
                            {ci.menuItem.name}
                          </h5>
                          {ci.options && (
                            <div className="text-[10px] text-amber-400/90 truncate mt-0.5">
                              {[
                                ci.options.milk ? `شیر: ${ci.options.milk}` : null,
                                ci.options.sugar ? `شکر: ${ci.options.sugar}` : null,
                                ci.options.extraShot ? `+شات دوبل` : null,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </div>
                          )}
                          {ci.specialNote && (
                            <p className="text-[10px] text-stone-400 italic truncate">
                              "{ci.specialNote}"
                            </p>
                          )}
                          <div className="text-xs font-black text-amber-400 mt-1 font-mono">
                            {formatPriceToman(ci.itemTotal)}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1.5 bg-stone-900 p-1 rounded-xl border border-stone-800">
                          <button
                            onClick={() => onUpdateQuantity(ci.id, ci.quantity - 1)}
                            className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-white">
                            {toPersianDigits(ci.quantity)}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(ci.id, ci.quantity + 1)}
                            className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Order Options */}
                  <div className="space-y-4 pt-4 border-t border-stone-800">
                    {/* Order Type Toggle */}
                    <div>
                      <label className="text-xs font-bold text-stone-400 block mb-2">
                        نوع سفارش:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setOrderType('dine-in')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            orderType === 'dine-in'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-md'
                              : 'bg-stone-950/60 text-stone-400 border-stone-800 hover:bg-stone-800'
                          }`}
                        >
                          <span>🪑 میل در سالن کافه</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderType('takeaway')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            orderType === 'takeaway'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-md'
                              : 'bg-stone-950/60 text-stone-400 border-stone-800 hover:bg-stone-800'
                          }`}
                        >
                          <span>🛍️ بسته‌بندی بیرون‌بر</span>
                        </button>
                      </div>
                    </div>

                    {/* Table selector (if dine-in) */}
                    {orderType === 'dine-in' && (
                      <div>
                        <label className="text-xs font-bold text-stone-400 block mb-2">
                          انتخاب شماره میز شما در سالن:
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setTableNumber(num)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                tableNumber === num
                                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-500/20'
                                  : 'bg-stone-950/60 text-stone-300 border-stone-800 hover:bg-stone-800'
                              }`}
                            >
                              {toPersianDigits(num)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Customer Info */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-stone-400 block mb-1">
                          نام یا عنوان سفارش:
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="مثلاً: آقای امینی"
                          className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-400 block mb-1">
                          شماره تماس (اختیاری):
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="0912..."
                          dir="ltr"
                          className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 placeholder:text-stone-600 text-right focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* General Notes */}
                    <div>
                      <label className="text-[11px] text-stone-400 block mb-1">
                        توضیحات کلی برای فاکتور:
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="درخواست‌های اضافی، زمان‌بندی سرو و..."
                        className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Barista Notice */}
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        سفارش شما بلافاصله در سیستم کافه ثبت و به صف آماده‌سازی باریستا منتقل می‌شود.
                      </span>
                    </div>

                    {errorMsg && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                        {errorMsg}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="p-5 bg-stone-950 border-t border-stone-800 space-y-3">
                <div className="flex items-center justify-between text-stone-400 text-xs">
                  <span>مجموع سفارش ({toPersianDigits(cartItems.length)} آیتم):</span>
                  <span className="text-white font-bold font-mono">
                    {formatPriceToman(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-stone-200 text-sm font-black pt-2 border-t border-stone-900">
                  <span className="text-amber-400">مبلغ نهایی قابل پرداخت:</span>
                  <span className="text-lg text-amber-400 font-mono">
                    {formatPriceToman(subtotal)}
                  </span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={isSubmitting}
                  onClick={handleCheckout}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-stone-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                      در حال ثبت و ارسال سفارش...
                    </span>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-stone-950" />
                      <span>تایید نهایی و ارسال سفارش به کافه</span>
                    </>
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

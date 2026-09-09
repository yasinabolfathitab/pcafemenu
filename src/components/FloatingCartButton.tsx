import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ChevronLeft, Sparkles } from 'lucide-react';
import { formatPriceToman, toPersianDigits } from '../utils/formatters';

interface FloatingCartButtonProps {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  activeTab: 'menu' | 'track' | 'admin';
}

export const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
  cartCount,
  cartTotal,
  onOpenCart,
  activeTab,
}) => {
  // Hide when in admin mode to avoid cluttering admin dashboard
  if (activeTab === 'admin') {
    return null;
  }

  return (
    <aside
      aria-label="دسترسی سریع به سبد خرید"
      className="pointer-events-none"
    >
      {/* ========================================================================= */}
      {/* DESKTOP FIXED CART (Screens >= md)                                        */}
      {/* Fixed at bottom-left corner so it doesn't obscure RTL Persian text       */}
      {/* ========================================================================= */}
      <div className="hidden md:block fixed bottom-8 left-8 z-40 pointer-events-auto">
        <AnimatePresence mode="wait">
          {cartCount > 0 ? (
            /* Active Cart: Rich Floating Pill with Count, Price, and Action */
            <motion.button
              key="desktop-active-cart"
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenCart}
              className="group flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-stone-900/95 backdrop-blur-xl border border-amber-500/40 text-white shadow-2xl shadow-black/80 hover:border-amber-400 hover:shadow-amber-500/20 transition-all cursor-pointer select-none"
            >
              {/* Icon & Count Badge */}
              <div className="relative flex items-center justify-center">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center text-stone-950 shadow-md shadow-amber-500/30 group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-stone-950 text-[11px] font-black text-amber-400 border border-amber-500 shadow-md">
                  {toPersianDigits(cartCount)}
                </span>
              </div>

              {/* Price & Label Details */}
              <div className="text-right space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-amber-300/90 font-medium">
                    سبد خرید ({toPersianDigits(cartCount)} قلم)
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-sm font-black text-white font-mono tracking-tight">
                  {formatPriceToman(cartTotal)}
                </div>
              </div>

              {/* CTA Arrow Button */}
              <div className="mr-2 pl-1 pr-2.5 py-1.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500 text-amber-300 group-hover:text-stone-950 border border-amber-500/20 group-hover:border-amber-400 flex items-center gap-1 text-xs font-bold transition-all">
                <span>تکمیل سفارش</span>
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </div>
            </motion.button>
          ) : (
            /* Empty Cart: Sleek Compact Floating Action Button */
            <motion.button
              key="desktop-empty-cart"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenCart}
              className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-stone-900/90 backdrop-blur-xl border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-white shadow-xl shadow-black/60 transition-all cursor-pointer select-none"
              title="مشاهده سبد خرید"
            >
              <div className="w-8 h-8 rounded-xl bg-stone-800 group-hover:bg-amber-500/20 text-stone-300 group-hover:text-amber-400 flex items-center justify-center transition-colors">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold">سبد خرید</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE FIXED CART (Screens < md)                                          */}
      {/* Positioned above the mobile bottom nav bar (bottom-[70px])                */}
      {/* ========================================================================= */}
      <div className="block md:hidden pointer-events-auto">
        <AnimatePresence>
          {cartCount > 0 ? (
            /* When cart has items: Prominent Sticky Floating Checkout Bar */
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="fixed bottom-[68px] inset-x-3 z-40 max-w-lg mx-auto"
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onOpenCart}
                className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/90 backdrop-blur-xl border border-amber-500/50 text-white shadow-2xl shadow-black/90 active:border-amber-400 transition-all cursor-pointer"
              >
                {/* Left Side: Cart Icon & Count */}
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center text-stone-950 shadow-md shadow-amber-500/40">
                      <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-stone-950 text-[10px] font-black text-amber-400 border border-amber-500">
                      {toPersianDigits(cartCount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-amber-300 font-bold block">
                      {toPersianDigits(cartCount)} قلم انتخاب شده
                    </span>
                    <span className="text-xs font-black text-white font-mono">
                      {formatPriceToman(cartTotal)}
                    </span>
                  </div>
                </div>

                {/* Right Side: CTA View Cart & Arrow */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-stone-950 text-xs font-black shadow-md shadow-amber-500/30">
                  <span>مشاهده سبد و ثبت</span>
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </div>
              </motion.button>
            </motion.div>
          ) : (
            /* When cart is empty: Compact floating button at bottom-left */
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed bottom-[70px] left-3 z-40"
            >
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onOpenCart}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-900/90 backdrop-blur-xl border border-stone-800 hover:border-amber-500/40 text-stone-300 shadow-xl shadow-black/80 active:bg-stone-800 transition-all cursor-pointer"
                title="سبد خرید"
              >
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-stone-200">سبد خرید</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
};

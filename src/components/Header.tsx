import React from 'react';
import { Coffee, ShoppingBag, ShieldCheck, Send, Clock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { formatPriceToman, toPersianDigits } from '../utils/formatters';

interface HeaderProps {
  activeTab: 'menu' | 'track' | 'admin';
  setActiveTab: (tab: 'menu' | 'track' | 'admin') => void;
  cartCount: number;
  cartTotal: number;
  openCart: () => void;
  openAdminModal: () => void;
  isAdminLoggedIn: boolean;
  activeOrderCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  cartTotal,
  openCart,
  openAdminModal,
  isAdminLoggedIn,
  activeOrderCount,
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-stone-950/90 border-b border-amber-500/20 shadow-2xl w-full">
      {/* Top Welcome & Service Bar */}
      <div className="bg-gradient-to-r from-amber-950/80 via-stone-900 to-amber-950/80 border-b border-amber-500/10 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs text-amber-200/90">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 truncate">
            <span className="flex h-2 w-2 relative flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-stone-300 font-medium truncate">
              کافه باز است | ثبت سفارش آنلاین و بیرون‌بر
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-stone-400 flex-shrink-0">
            <a
              href="tel:02122003344"
              className="flex items-center gap-1 font-mono text-amber-400 hover:text-amber-300 font-bold transition-colors"
              dir="ltr"
            >
              021-22003344
            </a>
            <span className="hidden md:flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              کیفیت برتر قهوه تخصصی
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Logo & Cafe Identity */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 cursor-pointer select-none flex-shrink-0"
            onClick={() => setActiveTab('menu')}
          >
            <div className="relative group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all duration-300">
                <div className="w-full h-full bg-stone-950 rounded-[10px] sm:rounded-[14px] flex items-center justify-center">
                  <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-black">
                P
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                  <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent font-black">
                    P CAFE
                  </span>
                  <span className="text-[10px] sm:text-xs font-normal px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hidden xs:inline-block">
                    کافه پی
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-stone-400 font-light hidden sm:block">
                اسپشالتی کافی و شیرینی‌پزی دست‌ساز
              </p>
            </div>
          </motion.div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'menu'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <Coffee className="w-4 h-4" />
              <span>منوی کافه</span>
            </button>

            <button
              onClick={() => setActiveTab('track')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 relative ${
                activeTab === 'track'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>پیگیری سفارش</span>
              {activeOrderCount > 0 && (
                <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white shadow-sm">
                  {toPersianDigits(activeOrderCount)}
                </span>
              )}
            </button>

            {/* Admin Portal Button */}
            <button
              onClick={() => {
                if (isAdminLoggedIn) {
                  setActiveTab('admin');
                } else {
                  openAdminModal();
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 border ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-stone-950 font-bold border-amber-400 shadow-lg shadow-amber-500/25'
                  : 'border-stone-800 text-stone-300 hover:text-amber-400 hover:border-amber-500/30 hover:bg-stone-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>پنل مدیریت</span>
            </button>

            {/* Cart Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={openCart}
              className="relative p-2.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950" />
              <span className="text-xs font-black">
                {cartTotal > 0 ? formatPriceToman(cartTotal) : 'سبد خرید'}
              </span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-950 text-[11px] font-black text-amber-400 border border-amber-500 shadow-md">
                  {toPersianDigits(cartCount)}
                </span>
              )}
            </motion.button>
          </div>

          {/* Mobile Quick Action Buttons (Under md screen) */}
          <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
            {/* Mobile Track Button */}
            <button
              onClick={() => setActiveTab('track')}
              className={`p-2 rounded-xl border flex items-center justify-center relative transition-all ${
                activeTab === 'track'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'border-stone-800 text-stone-300 bg-stone-900/60'
              }`}
              title="پیگیری سفارش"
            >
              <Clock className="w-4 h-4" />
              {activeOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-0.5 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white shadow">
                  {toPersianDigits(activeOrderCount)}
                </span>
              )}
            </button>

            {/* Mobile Admin Portal Button */}
            <button
              onClick={() => {
                if (isAdminLoggedIn) {
                  setActiveTab('admin');
                } else {
                  openAdminModal();
                }
              }}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold'
                  : 'border-stone-800 text-stone-300 bg-stone-900/60'
              }`}
              title="پنل مدیریت"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>

            {/* Mobile Cart Button */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={openCart}
              className="relative px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-black shadow-md flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4 text-stone-950" />
              {cartCount > 0 ? (
                <span className="text-[11px] font-black">
                  {toPersianDigits(cartCount)}
                </span>
              ) : (
                <span className="text-[11px] font-bold">سبد</span>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
};

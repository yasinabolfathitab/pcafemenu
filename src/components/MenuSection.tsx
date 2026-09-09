import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sparkles, Flame, Coffee, GlassWater, Cake, UtensilsCrossed, CupSoda, Heart, Award, ArrowLeft, Cookie, Layers } from 'lucide-react';
import { MenuItem, CategoryId, Category } from '../types';
import { CATEGORIES } from '../data/initialMenu';
import { MenuItemCard } from './MenuItemCard';
import { toPersianDigits } from '../utils/formatters';

interface MenuSectionProps {
  menuItems: MenuItem[];
  onSelectItem: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem, e: React.MouseEvent) => void;
  cartItemIds: Set<string>;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  menuItems,
  onSelectItem,
  onQuickAdd,
  cartItemIds,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [specialFilter, setSpecialFilter] = useState<'all' | 'popular' | 'special'>('all');

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Coffee': return Coffee;
      case 'GlassWater': return GlassWater;
      case 'Sparkles': return Sparkles;
      case 'Cake': return Cake;
      case 'UtensilsCrossed': return UtensilsCrossed;
      case 'CupSoda': return CupSoda;
      case 'Cookie': return Cookie;
      case 'Layers': return Layers;
      case 'Flame': return Flame;
      default: return Coffee;
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.enName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.ingredients && item.ingredients.some((ing) => ing.toLowerCase().includes(searchQuery.toLowerCase())));
    
    let matchSpecial = true;
    if (specialFilter === 'popular') matchSpecial = !!item.isPopular;
    if (specialFilter === 'special') matchSpecial = !!item.isSpecial;

    return matchCat && matchSearch && matchSpecial;
  });

  return (
    <div className="space-y-6 sm:space-y-10 pb-16">
      {/* 3D Hero Luxury Banner */}
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[36px] bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 border border-amber-500/30 p-5 sm:p-8 md:p-10 shadow-2xl">
        {/* Decorative Ambient Gradients */}
        <div className="absolute -top-24 -left-24 w-72 sm:w-96 h-72 sm:h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 sm:w-96 h-72 sm:h-96 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-3 sm:space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] sm:text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>منوی آنلاین و ثبت سفارش اختصاصی P Cafe</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl sm:text-3xl md:text-5xl font-black text-white leading-tight"
          >
            تجربه طعم بی‌نظیر قهوه‌های{' '}
            <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              اسپشالتی و دسرهای روز
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed font-light"
          >
            آیتم‌های مورد نظرتان را انتخاب کنید، سفارشتان را شخصی‌سازی کرده و ثبت نمایید. سفارش شما مستقیماً برای باریستا ارسال و با بالاترین کیفیت آماده خواهد شد.
          </motion.p>

          {/* Quick Badges */}
          <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-stone-400">
            <div className="flex items-center gap-1.5 bg-stone-900/90 px-2.5 py-1.5 rounded-xl border border-stone-800">
              <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>دانه‌های ۱۰۰٪ عربیکا</span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-900/90 px-2.5 py-1.5 rounded-xl border border-stone-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>پخت روزانه کیک و کروسان</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Quick Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-stone-400 absolute right-4 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در منو (لاته، چیزکیک، ماکتل، موهیتو...)"
            className="w-full pl-4 pr-11 py-3 rounded-2xl bg-stone-900 border border-stone-800 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-3 text-xs text-stone-400 hover:text-white"
            >
              پاک کردن
            </button>
          )}
        </div>

        {/* Special Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSpecialFilter('all')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              specialFilter === 'all'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
            }`}
          >
            همه آیتم‌ها
          </button>
          <button
            onClick={() => setSpecialFilter('popular')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              specialFilter === 'popular'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>محبوب و پرفروش</span>
          </button>
          <button
            onClick={() => setSpecialFilter('special')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              specialFilter === 'special'
                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-md'
                : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>ویژه P Cafe</span>
          </button>
        </div>
      </div>

      {/* Category Pills Navigation Carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-stone-400">دسته‌بندی‌های منو:</h3>
          <span className="text-xs text-stone-500 font-mono">
            {toPersianDigits(filteredItems.length)} محصول
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
          {/* All Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedCategory('all')}
            className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between h-20 ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-stone-950 border-amber-400 shadow-lg shadow-amber-500/25'
                : 'bg-stone-900/80 text-stone-300 border-stone-800 hover:border-stone-700 hover:bg-stone-800/60'
            }`}
          >
            <Coffee className={`w-5 h-5 ${selectedCategory === 'all' ? 'text-stone-950' : 'text-amber-400'}`} />
            <div>
              <div className="font-bold text-xs">همه دسته‌ها</div>
              <div className={`text-[10px] ${selectedCategory === 'all' ? 'text-stone-900' : 'text-stone-500'}`}>
                {toPersianDigits(menuItems.length)} قلم
              </div>
            </div>
          </motion.button>

          {CATEGORIES.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            const isSelected = selectedCategory === cat.id;
            const count = menuItems.filter((it) => it.category === cat.id).length;

            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between h-20 ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-stone-950 border-amber-400 shadow-lg shadow-amber-500/25'
                    : 'bg-stone-900/80 text-stone-300 border-stone-800 hover:border-stone-700 hover:bg-stone-800/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? 'text-stone-950' : 'text-amber-400'}`} />
                <div>
                  <div className="font-bold text-xs truncate">{cat.name}</div>
                  <div className={`text-[10px] ${isSelected ? 'text-stone-900' : 'text-stone-500'}`}>
                    {toPersianDigits(count)} قلم
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Menu Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-stone-900/40 rounded-3xl border border-stone-800 p-8 space-y-3">
          <Coffee className="w-12 h-12 text-stone-600 mx-auto" />
          <h4 className="text-stone-200 font-bold text-base">موردی با این مشخصات یافت نشد</h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            عبارت دیگری جستجو کنید یا فیلتر دسته‌بندی را تغییر دهید.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSpecialFilter('all');
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 text-xs font-bold"
          >
            مشاهده کل منو
          </button>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onSelect={onSelectItem}
                onQuickAdd={onQuickAdd}
                isInCart={cartItemIds.has(item.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

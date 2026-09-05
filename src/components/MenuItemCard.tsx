import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Clock, Flame, Sparkles, Check, Heart, Eye } from 'lucide-react';
import { MenuItem } from '../types';
import { formatPriceToman, toPersianDigits } from '../utils/formatters';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem, e: React.MouseEvent) => void;
  isInCart?: boolean;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  onSelect,
  onQuickAdd,
  isInCart = false,
}) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = -((y - centerY) / centerY) * 10;
    const rY = ((x - centerX) / centerX) * 10;

    setRotateX(rX);
    setRotateY(rY);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="perspective-1000 h-full"
    >
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => onSelect(item)}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.15s ease-out',
        }}
        className={`relative h-full flex flex-col rounded-3xl overflow-hidden cursor-pointer backdrop-blur-md transition-shadow duration-300 border ${
          item.isAvailable
            ? 'bg-gradient-to-b from-stone-900/90 to-stone-950/95 border-stone-800/80 hover:border-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/10'
            : 'bg-stone-950/60 border-stone-800/40 opacity-70 grayscale-[30%]'
        }`}
      >
        {/* Top Image Container */}
        <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-stone-900">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
            {item.isSpecial && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/90 backdrop-blur-md text-stone-950 shadow-md">
                <Sparkles className="w-3 h-3 text-stone-950" />
                ویژه P Cafe
              </span>
            )}
            {item.isPopular && !item.isSpecial && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/90 backdrop-blur-md text-white shadow-md">
                <Flame className="w-3 h-3 text-white" />
                محبوب و پرفروش
              </span>
            )}
          </div>

          {/* Prep time & Calories Pill */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[11px] text-stone-300 bg-stone-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-stone-800">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              {toPersianDigits(item.prepTime)} دقیقه
            </span>
            {item.calories && (
              <>
                <span className="text-stone-600">•</span>
                <span>{toPersianDigits(item.calories)} کالری</span>
              </>
            )}
          </div>

          {/* Heart button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsLiked(!isLiked);
            }}
            className="absolute top-3 left-3 p-2 rounded-full bg-stone-950/60 backdrop-blur-md text-stone-300 hover:text-rose-400 transition-colors border border-stone-800"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Card Content */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                {item.name}
              </h3>
            </div>
            <p className="text-xs text-stone-400 font-mono tracking-wide mb-2 line-clamp-1">
              {item.enName}
            </p>
            <p className="text-xs text-stone-300 leading-relaxed line-clamp-2 mb-3">
              {item.description}
            </p>
          </div>

          {/* Ingredients tags */}
          {item.ingredients && item.ingredients.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {item.ingredients.slice(0, 2).map((ing, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-stone-800/70 text-stone-300 border border-stone-700/50 line-clamp-1"
                >
                  {ing}
                </span>
              ))}
              {item.ingredients.length > 2 && (
                <span className="text-[10px] px-1.5 py-0.5 text-stone-400">
                  +{toPersianDigits(item.ingredients.length - 2)} مورد
                </span>
              )}
            </div>
          )}

          {/* Footer Price & Add Button */}
          <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-stone-400 block">قیمت:</span>
              <span className="text-sm sm:text-base font-black text-amber-400">
                {formatPriceToman(item.price)}
              </span>
            </div>

            {item.isAvailable ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item);
                  }}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition-colors flex items-center gap-1"
                  title="مشاهده جزئیات و شخصی‌سازی"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={(e) => onQuickAdd(item, e)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all ${
                    isInCart
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950'
                  }`}
                >
                  {isInCart ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>در سبد</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن</span>
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 text-stone-500 font-medium">
                به اتمام رسید
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

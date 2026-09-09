import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, Coffee, Sparkles, Clock, Flame, Check, MessageSquare } from 'lucide-react';
import { MenuItem, CartItemOption } from '../types';
import { formatPriceToman, toPersianDigits } from '../utils/formatters';

interface ItemDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (item: MenuItem, quantity: number, options: CartItemOption, specialNote: string) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onAddToCart,
}) => {
  if (!item) return null;

  const [quantity, setQuantity] = useState<number>(1);
  const [selectedMilk, setSelectedMilk] = useState<string>(
    item.customizationOptions?.milk ? item.customizationOptions.milk[0] : ''
  );
  const [selectedSugar, setSelectedSugar] = useState<string>(
    item.customizationOptions?.sugar ? item.customizationOptions.sugar[0] : ''
  );
  const [extraShot, setExtraShot] = useState<boolean>(false);
  const [specialNote, setSpecialNote] = useState<string>('');

  const extraShotCost = extraShot ? 25000 : 0;
  const unitPrice = item.price + extraShotCost;
  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
    onAddToCart(
      item,
      quantity,
      {
        milk: selectedMilk || undefined,
        sugar: selectedSugar || undefined,
        extraShot: extraShot || undefined,
      },
      specialNote
    );
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30, rotateX: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-stone-900 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl z-10 my-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-stone-950/70 hover:bg-stone-950 text-stone-300 hover:text-white transition-all backdrop-blur-md border border-stone-800"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Hero Image */}
          <div className="relative h-60 w-full overflow-hidden bg-stone-950 flex items-center justify-center">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-stone-850 via-stone-900 to-stone-950">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2 shadow-inner">
                  <Coffee className="w-8 h-8 stroke-[1.5]" />
                </div>
                <span className="text-sm font-black text-amber-400 tracking-wider">P CAFE SPECIALTY</span>
                <span className="text-xs text-stone-400 mt-1">آماده بارگذاری تصویر از پنل مدیریت</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/30 to-transparent pointer-events-none" />

            <div className="absolute bottom-4 right-4 left-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.isSpecial && (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-stone-950 shadow-md">
                    <Sparkles className="w-3.5 h-3.5" />
                    سیگنچر P Cafe
                  </span>
                )}
                {item.isPopular && (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-md">
                    <Flame className="w-3.5 h-3.5" />
                    پرفروش
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-300 bg-stone-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-stone-800">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>زمان آماده‌سازی: {toPersianDigits(item.prepTime)} دقیقه</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-1">
                {item.name}
              </h2>
              <p className="text-xs text-amber-400 font-mono mb-3">
                {item.enName}
              </p>
              <p className="text-sm text-stone-300 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Ingredients */}
            {item.ingredients && item.ingredients.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-stone-400 mb-2 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  ترکیبات و مواد تشکیل‌دهنده:
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {item.ingredients.map((ing, i) => (
                    <span
                      key={i}
                      className="text-xs px-3 py-1 rounded-lg bg-stone-800/80 text-stone-200 border border-stone-700/60"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Customization Options */}
            {item.customizationOptions && (
              <div className="space-y-4 pt-4 border-t border-stone-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  شخصی‌سازی سفارش شما:
                </h4>

                {/* Milk selection */}
                {item.customizationOptions.milk && (
                  <div>
                    <label className="text-xs text-stone-400 block mb-2 font-medium">
                      انتخاب نوع شیر:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {item.customizationOptions.milk.map((milk) => (
                        <button
                          key={milk}
                          type="button"
                          onClick={() => setSelectedMilk(milk)}
                          className={`p-2.5 rounded-xl text-xs font-medium text-right transition-all border flex items-center justify-between ${
                            selectedMilk === milk
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-md'
                              : 'bg-stone-800/50 text-stone-300 border-stone-800 hover:bg-stone-800'
                          }`}
                        >
                          <span>{milk}</span>
                          {selectedMilk === milk && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sugar level selection */}
                {item.customizationOptions.sugar && (
                  <div>
                    <label className="text-xs text-stone-400 block mb-2 font-medium">
                      میزان شیرینی و شکر:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {item.customizationOptions.sugar.map((sugar) => (
                        <button
                          key={sugar}
                          type="button"
                          onClick={() => setSelectedSugar(sugar)}
                          className={`p-2.5 rounded-xl text-xs font-medium text-center transition-all border ${
                            selectedSugar === sugar
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                              : 'bg-stone-800/50 text-stone-300 border-stone-800 hover:bg-stone-800'
                          }`}
                        >
                          {sugar}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra Shot Option */}
                {item.customizationOptions.extraShot && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-stone-800/40 border border-stone-800">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        افزودن یک شات اسپرسو اضافه (Double Shot)
                      </span>
                      <span className="text-[11px] text-amber-400 font-mono">
                        +{formatPriceToman(25000)}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={extraShot}
                      onChange={(e) => setExtraShot(e.target.checked)}
                      className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Special Barista Note */}
            <div className="pt-2">
              <label className="text-xs text-stone-400 font-medium block mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                توضیحات یا درخواست خاص از باریستا (اختیاری):
              </label>
              <textarea
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="مثلاً: بدون یخ، فوم بیشتر، سیروپ جداگانه..."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-amber-500 transition-colors resize-none placeholder:text-stone-600"
              />
            </div>
          </div>

          {/* Footer with Quantity and Add Button */}
          <div className="p-4 sm:p-6 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-4">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-2 bg-stone-900 p-1 rounded-2xl border border-stone-800">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-6 text-center font-black text-white text-sm">
                {toPersianDigits(quantity)}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Total Price & Add to Cart Action */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleAdd}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm sm:text-base flex items-center justify-between shadow-xl shadow-amber-500/20 transition-all"
            >
              <span>افزودن به سفارش</span>
              <span className="font-bold font-mono">
                {formatPriceToman(totalPrice)}
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

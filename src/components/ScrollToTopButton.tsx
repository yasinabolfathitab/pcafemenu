import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  cartCount?: number;
  threshold?: number;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  cartCount = 0,
  threshold = 300,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial scroll state
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  const scrollToTop = () => {
    try {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`fixed z-40 right-3.5 sm:right-5 transition-all duration-300 pointer-events-auto ${
            // In mobile view: if cart bar is visible (cartCount > 0), float above the checkout bar
            cartCount > 0 ? 'bottom-[132px] md:bottom-8' : 'bottom-[72px] md:bottom-8'
          }`}
        >
          <motion.button
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            aria-label="بازگشت به بالای صفحه"
            title="بازگشت به بالای صفحه"
            className="group flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-stone-900/90 hover:bg-stone-850 active:bg-amber-500 backdrop-blur-xl border border-amber-500/40 hover:border-amber-400 text-amber-400 active:text-stone-950 shadow-2xl shadow-black/90 hover:shadow-amber-500/20 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <div className="relative flex flex-col items-center justify-center">
              <ArrowUp className="w-5 h-5 sm:w-5 sm:h-5 stroke-[2.4] group-hover:-translate-y-0.5 transition-transform" />
              <span className="sr-only">بازگشت به بالا</span>
            </div>

            {/* Subtle glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

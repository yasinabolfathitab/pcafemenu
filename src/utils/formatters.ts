import { OrderStatus } from '../types';

/**
 * Returns digits in standard English format as requested
 */
export function toPersianDigits(n: number | string): string {
  if (n === null || n === undefined) return '';
  return String(n);
}

export function formatPriceToman(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 تومان';
  const formatted = amount.toLocaleString('en-US');
  return `${formatted} تومان`;
}

export function getStatusDetails(status: OrderStatus): {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  iconName: string;
  stepIndex: number;
} {
  switch (status) {
    case 'pending':
      return {
        label: 'در انتظار تایید باریستا',
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
        iconName: 'Clock',
        stepIndex: 0,
      };
    case 'preparing':
      return {
        label: 'در حال آماده‌سازی قهوه و بار',
        colorClass: 'text-sky-400',
        bgClass: 'bg-sky-500/10',
        borderClass: 'border-sky-500/30',
        iconName: 'Coffee',
        stepIndex: 1,
      };
    case 'ready':
      return {
        label: 'آماده تحویل / سرو روی میز',
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500/30',
        iconName: 'Bell',
        stepIndex: 2,
      };
    case 'completed':
      return {
        label: 'تحویل داده شد و تسویه گردید',
        colorClass: 'text-stone-400',
        bgClass: 'bg-stone-800/40',
        borderClass: 'border-stone-700/40',
        iconName: 'CheckCircle2',
        stepIndex: 3,
      };
    case 'cancelled':
      return {
        label: 'سفارش لغو شده',
        colorClass: 'text-rose-400',
        bgClass: 'bg-rose-500/10',
        borderClass: 'border-rose-500/30',
        iconName: 'XCircle',
        stepIndex: -1,
      };
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const diffSeconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diffSeconds < 60) {
      return 'همین الان';
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} دقیقه پیش`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} ساعت پیش`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} روز پیش`;
  } catch {
    return dateString;
  }
}

export function formatPersianTimeOnly(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return dateString;
  }
}

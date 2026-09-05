import { MenuItem, Order, OrderStatus } from '../types';
import { INITIAL_MENU_ITEMS } from '../data/initialMenu';

const TELEGRAM_BOT_TOKEN = '8632037639:AAFZm5TzaEj5Dy5o1EK2Ve0Z5UXjEsRtHx8';
const TELEGRAM_CHANNEL_ID = '-1004411658114'; // @pcafedata

const LOCAL_STORAGE_ORDERS_KEY = 'pcafe_all_orders';
const LOCAL_STORAGE_MENU_KEY = 'pcafe_custom_menu';

// Helper to format Persian date
function formatPersianDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

function formatPrice(num: number): string {
  return num.toLocaleString('en-US') + ' تومان';
}

// Telegram Message Dispatcher
export async function sendTelegramNotification(order: Order): Promise<boolean> {
  try {
    const timeStr = formatPersianDate(order.createdAt);
    const typeStr =
      order.orderType === 'dine-in'
        ? `🪑 <b>میز شماره ${order.tableNumber}</b> (سالن)`
        : '🛍️ <b>بیرون‌بر (Takeaway)</b>';

    let itemsList = '';
    order.items.forEach((item, idx) => {
      let customText = '';
      if (item.options) {
        const opts = [];
        if (item.options.milk) opts.push(`شیر: ${item.options.milk}`);
        if (item.options.sugar) opts.push(`شکر: ${item.options.sugar}`);
        if (item.options.extraShot) opts.push(`+ شات دوبل`);
        if (item.options.syrup) opts.push(`سیروپ: ${item.options.syrup}`);
        if (opts.length > 0) {
          customText = ` <i>(${opts.join(' - ')})</i>`;
        }
      }
      itemsList += `  ▫️ ${idx + 1}. <b>${item.name}</b> × ${item.quantity} عدد${customText} — ${formatPrice(item.price * item.quantity)}\n`;
    });

    const text = `☕️ <b>سفارش جدید P Cafe دریافت شد!</b>

🆔 <b>شماره فاکتور:</b> <code>#PC-${order.orderNumber}</code>
👤 <b>نام مشتری:</b> ${order.customerName || 'مشتری گرامی'}
${order.customerPhone ? `📞 <b>شماره تماس:</b> <code>${order.customerPhone}</code>\n` : ''}📍 <b>نوع سفارش:</b> ${typeStr}
🕒 <b>زمان ثبت:</b> ${timeStr}

📋 <b>آیتم‌های سفارش:</b>
${itemsList}
💰 <b>مبلغ کل قابل پرداخت:</b> <b>${formatPrice(order.totalPrice)}</b>
${order.notes ? `\n📝 <b>یادداشت مشتری:</b> <i>${order.notes}</i>` : ''}

📌 <b>وضعیت کنونی:</b> ⏳ <i>در انتظار آماده‌سازی در باریستا</i>
✨ <i>سیستم سفارش‌گیری آنلاین و اختصاصی کافه پی (P Cafe)</i>`;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        text: text.slice(0, 4000),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    return Boolean(response.ok && data.ok);
  } catch (err) {
    console.warn('Telegram direct notification notice:', err);
    return false;
  }
}

// Read all cached orders from local storage
export function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading local orders:', e);
  }
  return [];
}

// Save all orders to local storage
export function saveLocalOrders(orders: Order[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn('Error saving local orders:', e);
  }
}

// Get Menu (with fallback)
export async function fetchMenuApi(): Promise<MenuItem[]> {
  try {
    const res = await fetch('/api/menu');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // network or static host fallback
  }

  try {
    const local = localStorage.getItem(LOCAL_STORAGE_MENU_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  return INITIAL_MENU_ITEMS;
}

// Get Orders (with fallback)
export async function fetchOrdersApi(): Promise<Order[]> {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Merge with local orders
        const local = getLocalOrders();
        const map = new Map<string, Order>();
        for (const o of local) map.set(o.id, o);
        for (const o of data) map.set(o.id, o);
        const combined = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        saveLocalOrders(combined);
        return combined;
      }
    }
  } catch (e) {
    // static host fallback
  }

  return getLocalOrders();
}

// Submit Order (Universal: Works with backend API AND static hosting with Telegram Bot)
export async function createOrderApi(payload: {
  customerName: string;
  customerPhone?: string;
  orderType: 'dine-in' | 'takeaway';
  tableNumber?: number;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    options?: any;
    specialNote?: string;
  }>;
  notes?: string;
}): Promise<{ success: boolean; order: Order; error?: string }> {
  // 1. Try Backend API first
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.order) {
        const local = getLocalOrders();
        saveLocalOrders([data.order, ...local.filter((o) => o.id !== data.order.id)]);
        return { success: true, order: data.order };
      }
    }
  } catch (e) {
    console.info('Backend API unavailable, utilizing direct resilient order processor.');
  }

  // 2. Resilient Client-Side Handler (for Cloudflare Pages / Static Deployments)
  try {
    const local = getLocalOrders();
    let maxOrderNum = 1000;
    for (const ord of local) {
      if (typeof ord.orderNumber === 'number' && ord.orderNumber > maxOrderNum) {
        maxOrderNum = ord.orderNumber;
      }
    }

    const orderNumber = maxOrderNum + 1;
    const now = new Date().toISOString();
    const totalPrice = payload.items.reduce((acc, it) => acc + it.price * it.quantity, 0);

    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      orderNumber,
      customerName: payload.customerName || 'مشتری گرامی',
      customerPhone: payload.customerPhone,
      orderType: payload.orderType,
      tableNumber: payload.orderType === 'dine-in' ? (payload.tableNumber || 1) : undefined,
      items: payload.items,
      totalPrice,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      telegramNotified: false,
      notes: payload.notes,
    };

    // Send Telegram Notification directly from client
    const telegramOk = await sendTelegramNotification(newOrder);
    newOrder.telegramNotified = telegramOk;

    // Save to local storage
    saveLocalOrders([newOrder, ...local]);

    return { success: true, order: newOrder };
  } catch (err: any) {
    console.error('Order creation failed:', err);
    return { success: false, order: null as any, error: err.message || 'خطا در ثبت سفارش' };
  }
}

// Update Order Status
export async function updateOrderStatusApi(orderId: string, newStatus: OrderStatus): Promise<boolean> {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.order) {
        const local = getLocalOrders();
        saveLocalOrders(local.map((o) => (o.id === orderId ? data.order : o)));
        return true;
      }
    }
  } catch (e) {}

  // Fallback to local storage update
  const local = getLocalOrders();
  const updated = local.map((o) =>
    o.id === orderId ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o
  );
  saveLocalOrders(updated);
  return true;
}

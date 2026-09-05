import { MenuItem, Order, OrderStatus } from '../types';
import { INITIAL_MENU_ITEMS } from '../data/initialMenu';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

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
    console.warn('Telegram notification notice:', err);
    return false;
  }
}

// Local storage fallback handlers
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

export function saveLocalOrders(orders: Order[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn('Error saving local orders:', e);
  }
}

// Subscribe to real-time order updates across all devices via Firestore
export function subscribeToOrders(
  onOrdersChanged: (orders: Order[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersList: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          ordersList.push({
            ...data,
            id: docSnap.id,
          });
        });
        saveLocalOrders(ordersList);
        onOrdersChanged(ordersList);
      },
      (error) => {
        console.warn('Firestore real-time subscription error, fallback to local/polling:', error);
        if (onError) onError(error);
        onOrdersChanged(getLocalOrders());
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to attach Firestore snapshot:', err);
    onOrdersChanged(getLocalOrders());
    return () => {};
  }
}

// Get Menu (with cloud Firestore & local fallback)
export async function fetchMenuApi(): Promise<MenuItem[]> {
  try {
    const menuCol = collection(db, 'menuItems');
    const snapshot = await getDocs(menuCol);
    if (!snapshot.empty) {
      const items: MenuItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...(docSnap.data() as MenuItem), id: docSnap.id });
      });
      localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(items));
      return items;
    }
  } catch (e) {
    console.info('Using local fallback for menu');
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

// Get Orders once (Firestore + Local)
export async function fetchOrdersApi(): Promise<Order[]> {
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const list: Order[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...(docSnap.data() as Order), id: docSnap.id });
      });
      saveLocalOrders(list);
      return list;
    }
  } catch (e) {
    console.info('Using local cache for orders query');
  }

  return getLocalOrders();
}

// Submit Order (Syncs to Cloud Firestore + Telegram + Local Storage)
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
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customerName: payload.customerName || 'مشتری گرامی',
      customerPhone: payload.customerPhone || '',
      orderType: payload.orderType,
      tableNumber: payload.orderType === 'dine-in' ? (payload.tableNumber || 1) : undefined,
      items: payload.items,
      totalPrice,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      telegramNotified: false,
      notes: payload.notes || '',
    };

    // 1. Save to Cloud Firestore for instant cross-device live sync
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, newOrder);
    } catch (fsErr) {
      console.warn('Firestore setDoc notice (will rely on local & telegram):', fsErr);
    }

    // 2. Send Telegram Notification
    const telegramOk = await sendTelegramNotification(newOrder);
    newOrder.telegramNotified = telegramOk;

    // Update telegram notification status in Firestore if needed
    if (telegramOk) {
      try {
        const orderDocRef = doc(db, 'orders', orderId);
        await updateDoc(orderDocRef, { telegramNotified: true });
      } catch (e) {}
    }

    // 3. Save to local storage for instant UI response
    saveLocalOrders([newOrder, ...local]);

    return { success: true, order: newOrder };
  } catch (err: any) {
    console.error('Order creation failed:', err);
    return { success: false, order: null as any, error: err.message || 'خطا در ثبت سفارش' };
  }
}

// Update Order Status (Syncs to Cloud Firestore + Local)
export async function updateOrderStatusApi(orderId: string, newStatus: OrderStatus): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Cloud Firestore update
  try {
    const orderDocRef = doc(db, 'orders', orderId);
    await updateDoc(orderDocRef, {
      status: newStatus,
      updatedAt: now,
    });
  } catch (e) {
    console.warn('Error updating status in Firestore:', e);
  }

  // 2. Local Storage update
  const local = getLocalOrders();
  const updated = local.map((o) =>
    o.id === orderId ? { ...o, status: newStatus, updatedAt: now } : o
  );
  saveLocalOrders(updated);

  return true;
}

// Clear all orders (Admin only)
export async function clearAllOrdersApi(): Promise<boolean> {
  try {
    const ordersCol = collection(db, 'orders');
    const snapshot = await getDocs(ordersCol);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (e) {
    console.warn('Error clearing Firestore orders:', e);
  }

  saveLocalOrders([]);
  return true;
}

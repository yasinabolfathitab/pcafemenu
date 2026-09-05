import { MenuItem, Order, OrderStatus } from '../types';
import { INITIAL_MENU_ITEMS } from '../data/initialMenu';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

const TELEGRAM_BOT_TOKEN = '8632037639:AAFZm5TzaEj5Dy5o1EK2Ve0Z5UXjEsRtHx8';
const TELEGRAM_CHANNEL_ID = '-1004411658114'; // @pcafedata

const LOCAL_STORAGE_ORDERS_KEY = 'pcafe_all_orders';
const LOCAL_STORAGE_MENU_KEY = 'pcafe_custom_menu';

// Deep sanitizer: Firestore throws an error if any field in an object is `undefined`
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    } else {
      cleanObj[key] = null;
    }
  }
  return cleanObj as T;
}

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
  return (num || 0).toLocaleString('en-US') + ' تومان';
}

// Telegram Message Dispatcher
export async function sendTelegramNotification(order: Order): Promise<boolean> {
  try {
    const timeStr = formatPersianDate(order.createdAt);
    const typeStr =
      order.orderType === 'dine-in'
        ? `🪑 <b>میز شماره ${order.tableNumber || 1}</b> (سالن)`
        : '🛍️ <b>بیرون‌بر (Takeaway)</b>';

    let itemsList = '';
    order.items.forEach((item, idx) => {
      let customText = '';
      if (item.options) {
        const opts: string[] = [];
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

// Local storage helpers
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

    const unsubscribe = onSnapshot(
      ordersCol,
      (snapshot) => {
        const ordersList: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          ordersList.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort descending by creation date
        ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        saveLocalOrders(ordersList);
        onOrdersChanged(ordersList);
      },
      (error) => {
        console.warn('Firestore real-time subscription error, using local fallback:', error);
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

// Get Menu (Firestore with fallback)
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

// Add/Update/Delete Menu Items in Firestore
export async function saveMenuItemApi(item: MenuItem): Promise<boolean> {
  try {
    const docRef = doc(db, 'menuItems', item.id);
    await setDoc(docRef, sanitizeForFirestore(item));
    return true;
  } catch (e) {
    console.warn('Firestore saveMenuItem error:', e);
    return false;
  }
}

export async function deleteMenuItemApi(itemId: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'menuItems', itemId);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.warn('Firestore deleteMenuItem error:', e);
    return false;
  }
}

// Get Orders once (Firestore + Local)
export async function fetchOrdersApi(): Promise<Order[]> {
  try {
    const ordersCol = collection(db, 'orders');
    const snapshot = await getDocs(ordersCol);
    if (!snapshot.empty) {
      const list: Order[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...(docSnap.data() as Order), id: docSnap.id });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    // 1. Determine next orderNumber across all existing orders
    const local = getLocalOrders();
    let maxOrderNum = 1000;
    for (const ord of local) {
      if (typeof ord.orderNumber === 'number' && ord.orderNumber > maxOrderNum) {
        maxOrderNum = ord.orderNumber;
      }
    }

    try {
      const ordersCol = collection(db, 'orders');
      const snapshot = await getDocs(ordersCol);
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && typeof d.orderNumber === 'number' && d.orderNumber > maxOrderNum) {
          maxOrderNum = d.orderNumber;
        }
      });
    } catch (e) {
      // ignore if offline
    }

    const orderNumber = maxOrderNum + 1;
    const now = new Date().toISOString();
    const totalPrice = payload.items.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0);
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const cleanedItems = payload.items.map((it) => ({
      menuItemId: it.menuItemId || '',
      name: it.name || '',
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      options: it.options || {},
      specialNote: it.specialNote || '',
    }));

    const rawOrder: Order = {
      id: orderId,
      orderNumber,
      customerName: payload.customerName || 'مشتری گرامی',
      customerPhone: payload.customerPhone || '',
      orderType: payload.orderType,
      tableNumber: payload.orderType === 'dine-in' ? Number(payload.tableNumber || 1) : 0,
      items: cleanedItems,
      totalPrice,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      telegramNotified: false,
      notes: payload.notes || '',
    };

    // Sanitize completely to guarantee NO `undefined` reaches Firestore
    const newOrder = sanitizeForFirestore<Order>(rawOrder);

    // 2. Save to Cloud Firestore for instant cross-device sync
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, newOrder);
      console.log('Order successfully synced to Firestore:', orderId);
    } catch (fsErr) {
      console.error('Firestore setDoc error:', fsErr);
    }

    // Also notify Express server if running in full-stack mode
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    // 3. Send Telegram Notification
    const telegramOk = await sendTelegramNotification(newOrder);
    newOrder.telegramNotified = telegramOk;

    if (telegramOk) {
      try {
        const orderDocRef = doc(db, 'orders', orderId);
        await updateDoc(orderDocRef, { telegramNotified: true });
      } catch (e) {}
    }

    // 4. Save to local storage for local immediate update
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

  // Also notify Express server
  fetch(`/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  }).catch(() => {});

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

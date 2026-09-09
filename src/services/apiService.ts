import { MenuItem, Order, OrderStatus } from '../types';
import { INITIAL_MENU_ITEMS } from '../data/initialMenu';
import { getInitialSeedOrders } from '../data/initialOrders';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  supabase,
  isSupabaseConfigured,
  mapSupabaseOrderToAppOrder,
  mapAppOrderToSupabase,
  mapSupabaseMenuItemToApp,
  mapAppMenuItemToSupabase,
} from '../supabase';

const LOCAL_STORAGE_ORDERS_KEY = 'pcafe_all_orders';
const LOCAL_STORAGE_MY_ORDERS_KEY = 'pcafe_my_orders';
const LOCAL_STORAGE_MENU_KEY = 'pcafe_custom_menu';

// Helper to sanitize object for Firestore (Firestore rejects `undefined` values)
export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      out[key] = sanitizeForFirestore(val);
    }
  }
  return out;
}

// Local storage helpers (Guarantees offline resilience and zero-lag experience)
export function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      if (Array.isArray(parsed) && parsed.length === 0) return [];
    }
  } catch (e) {
    console.warn('Error reading local orders:', e);
  }
  // Initialize with seed orders on fresh startup/deploy
  const initial = getInitialSeedOrders();
  saveLocalOrders(initial);
  return initial;
}

export function saveLocalOrders(orders: Order[]) {
  try {
    const seen = new Set<string>();
    const unique: Order[] = [];
    for (const ord of orders) {
      if (ord && ord.id && !seen.has(ord.id)) {
        seen.add(ord.id);
        unique.push(ord);
      }
    }
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(unique));
  } catch (e) {
    console.warn('Error saving local orders:', e);
  }
}

// Customer private order cache helpers
export function getLocalMyOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MY_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalMyOrder(order: Order) {
  try {
    const existing = getLocalMyOrders();
    const updated = [order, ...existing.filter((o) => o.id !== order.id)];
    localStorage.setItem(LOCAL_STORAGE_MY_ORDERS_KEY, JSON.stringify(updated));
  } catch {}
}

export function updateLocalMyOrderStatus(orderId: string, status: OrderStatus) {
  try {
    const existing = getLocalMyOrders();
    const updated = existing.map((o) =>
      o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o
    );
    localStorage.setItem(LOCAL_STORAGE_MY_ORDERS_KEY, JSON.stringify(updated));
  } catch {}
}

// =========================================================================
// Real-time Order Subscription (Firestore onSnapshot + Supabase Real-time)
// =========================================================================
export function subscribeToOrders(
  onOrdersChanged: (orders: Order[]) => void,
  onError?: (err: any) => void
): () => void {
  let isUnsubscribed = false;
  let unsubscribeFirestore: (() => void) | null = null;
  let supabaseChannel: any = null;

  // 1. Primary: Real-time Cloud Firestore subscription
  // Works instantly across all devices on Cloudflare Pages, mobile, and laptop
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));

    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed) return;
        const liveOrders: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          liveOrders.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Save local cache
        saveLocalOrders(liveOrders);
        onOrdersChanged(liveOrders);
      },
      (err) => {
        console.warn('Firestore onSnapshot notice:', err);
        if (onError) onError(err);
        // Fallback to fetch
        fetchOrdersApi().then((data) => {
          if (!isUnsubscribed && Array.isArray(data)) {
            onOrdersChanged(data);
          }
        });
      }
    );
  } catch (fsErr) {
    console.warn('Failed to initialize Firestore listener:', fsErr);
  }

  // 2. Secondary: Real-time Supabase PostgreSQL Changes WebSockets (if configured)
  if (supabase && isSupabaseConfigured) {
    try {
      supabaseChannel = supabase
        .channel('realtime:orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          async (payload) => {
            if (isUnsubscribed) return;
            try {
              const freshOrders = await fetchOrdersApi();
              if (!isUnsubscribed) {
                onOrdersChanged(freshOrders);
              }
            } catch (err) {
              console.warn('Error reloading orders after Supabase event:', err);
            }
          }
        )
        .subscribe();
    } catch (wsErr) {
      console.warn('Failed to initialize Supabase WebSockets channel:', wsErr);
    }
  }

  // 3. Fallback background sync polling (every 5 seconds)
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const orders = await fetchOrdersApi();
      if (!isUnsubscribed && Array.isArray(orders) && orders.length > 0) {
        onOrdersChanged(orders);
      }
    } catch {
      // ignore
    }
  }, 5000);

  return () => {
    isUnsubscribed = true;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
    if (supabase && supabaseChannel) {
      supabase.removeChannel(supabaseChannel);
    }
    clearInterval(pollInterval);
  };
}

// =========================================================================
// Menu Operations (Firestore -> Supabase -> Express -> Local)
// =========================================================================

export async function fetchMenuApi(): Promise<MenuItem[]> {
  // 1. Primary: Cloud Firestore
  try {
    const menuCol = collection(db, 'menuItems');
    const snapshot = await getDocs(menuCol);

    // Map all items from Firestore
    const firestoreItems = new Map<string, MenuItem>();
    if (!snapshot.empty) {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as MenuItem;
        firestoreItems.set(docSnap.id, { ...data, id: docSnap.id });
      });
    }

    // Always ensure the full comprehensive menu exists by starting with INITIAL_MENU_ITEMS
    const fullMenuMap = new Map<string, MenuItem>();
    for (const it of INITIAL_MENU_ITEMS) {
      fullMenuMap.set(it.id, it);
    }

    // Apply any customized or newly created items from Firestore
    for (const [id, it] of firestoreItems.entries()) {
      fullMenuMap.set(id, it);
    }

    const mergedList = Array.from(fullMenuMap.values());

    // If Firestore has fewer items than INITIAL_MENU_ITEMS (e.g. only 1 item was saved),
    // seed the remaining items to Firestore so all devices have them permanently!
    if (snapshot.empty || snapshot.docs.length < INITIAL_MENU_ITEMS.length) {
      try {
        const batch = writeBatch(db);
        let count = 0;
        for (const it of INITIAL_MENU_ITEMS) {
          if (!firestoreItems.has(it.id)) {
            batch.set(doc(db, 'menuItems', it.id), sanitizeForFirestore(it));
            count++;
          }
        }
        if (count > 0) {
          batch.commit().then(() => {
            console.log(`✅ Seeded ${count} menu items to Firestore`);
          }).catch(() => {});
        }
      } catch (seedErr) {
        console.warn('Batch seeding notice:', seedErr);
      }
    }

    localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(mergedList));
    return mergedList;
  } catch (fsErr) {
    console.warn('Firestore fetch menu notice:', fsErr);
  }

  // 2. Supabase
  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('menu_items').select('*');
      if (!error && data && data.length > 0) {
        const items = data.map(mapSupabaseMenuItemToApp);
        // Also ensure all categories exist
        const fullMap = new Map<string, MenuItem>();
        for (const it of INITIAL_MENU_ITEMS) fullMap.set(it.id, it);
        for (const it of items) fullMap.set(it.id, it);
        const combined = Array.from(fullMap.values());
        localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(combined));
        return combined;
      }
    } catch (e) {
      console.warn('Supabase menu fetch exception:', e);
    }
  }

  // 3. Fallback to Express backend if running
  try {
    const res = await fetch('/api/menu');
    if (res.ok) {
      const menu = await res.json();
      if (Array.isArray(menu) && menu.length > 0) {
        const fullMap = new Map<string, MenuItem>();
        for (const it of INITIAL_MENU_ITEMS) fullMap.set(it.id, it);
        for (const it of menu) fullMap.set(it.id, it);
        const combined = Array.from(fullMap.values());
        localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(combined));
        return combined;
      }
    }
  } catch {}

  // 4. Fallback to local storage or INITIAL_MENU_ITEMS
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_MENU_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Always ensure newly added menu items from INITIAL_MENU_ITEMS are merged with existing user edits
        const fullMap = new Map<string, MenuItem>();
        for (const it of INITIAL_MENU_ITEMS) fullMap.set(it.id, it);
        for (const it of parsed) fullMap.set(it.id, it);
        const combined = Array.from(fullMap.values());
        localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(combined));
        return combined;
      }
    }
  } catch {}

  return INITIAL_MENU_ITEMS;
}

export async function saveMenuItemApi(item: MenuItem): Promise<boolean> {
  // 1. Local storage update
  try {
    const local = await fetchMenuApi();
    const idx = local.findIndex((i) => i.id === item.id);
    let updatedMenu: MenuItem[];
    if (idx >= 0) {
      updatedMenu = [...local];
      updatedMenu[idx] = item;
    } else {
      updatedMenu = [item, ...local];
    }
    localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(updatedMenu));
  } catch {}

  // 2. Primary: Cloud Firestore
  try {
    const sanitized = sanitizeForFirestore(item);
    await setDoc(doc(db, 'menuItems', item.id), sanitized);
  } catch (fsErr) {
    console.warn('Firestore save menu error:', fsErr);
  }

  // 3. Supabase
  if (supabase && isSupabaseConfigured) {
    try {
      const payload = mapAppMenuItemToSupabase(item);
      await supabase.from('menu_items').upsert(payload, { onConflict: 'id' });
    } catch (e) {
      console.warn('Supabase saveMenuItem error:', e);
    }
  }

  // 4. Express backend
  try {
    await fetch(`/api/menu/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } catch {}

  return true;
}

export async function deleteMenuItemApi(itemId: string): Promise<boolean> {
  // 1. Local cache
  try {
    const local = await fetchMenuApi();
    const updated = local.filter((i) => i.id !== itemId);
    localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(updated));
  } catch {}

  // 2. Primary: Cloud Firestore
  try {
    await deleteDoc(doc(db, 'menuItems', itemId));
  } catch (fsErr) {
    console.warn('Firestore delete menu error:', fsErr);
  }

  // 3. Supabase
  if (supabase && isSupabaseConfigured) {
    try {
      await supabase.from('menu_items').delete().eq('id', itemId);
    } catch (e) {}
  }

  // 4. Express
  try {
    await fetch(`/api/menu/${itemId}`, { method: 'DELETE' });
  } catch {}

  return true;
}

export async function resetDefaultMenuApi(): Promise<MenuItem[]> {
  try {
    const batch = writeBatch(db);
    for (const it of INITIAL_MENU_ITEMS) {
      batch.set(doc(db, 'menuItems', it.id), sanitizeForFirestore(it));
    }
    await batch.commit();
    console.log('✅ Default menu successfully reset in Firestore');
  } catch (e) {
    console.warn('Reset default menu notice:', e);
  }

  localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(INITIAL_MENU_ITEMS));
  return INITIAL_MENU_ITEMS;
}

// =========================================================================
// Order Operations (Firestore -> Supabase -> Express -> Local)
// =========================================================================

export async function fetchOrdersApi(): Promise<Order[]> {
  // 1. Primary: Cloud Firestore
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const orders: Order[] = [];
      snapshot.forEach((docSnap) => {
        orders.push({ ...(docSnap.data() as Order), id: docSnap.id });
      });
      saveLocalOrders(orders);
      return orders;
    }
  } catch (fsErr) {
    console.warn('Firestore fetch orders notice:', fsErr);
  }

  // 2. Supabase
  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const list = data.map(mapSupabaseOrderToAppOrder);
        saveLocalOrders(list);
        return list;
      }
    } catch (sbErr) {
      console.warn('Supabase fetch orders notice:', sbErr);
    }
  }

  // 3. Fallback: Express backend API
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const serverOrders: Order[] = await res.json();
      if (Array.isArray(serverOrders) && serverOrders.length > 0) {
        saveLocalOrders(serverOrders);
        return serverOrders;
      }
    }
  } catch {}

  return getLocalOrders();
}

export async function createOrderApi(payload: {
  customerName: string;
  customerPhone?: string;
  orderType: 'dine-in' | 'takeaway';
  tableNumber?: number | string;
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

    // Calculate maximum sequential order number
    let maxOrderNum = 1000;
    for (const ord of local) {
      if (typeof ord.orderNumber === 'number' && ord.orderNumber > maxOrderNum) {
        maxOrderNum = ord.orderNumber;
      }
    }

    const orderNumber = maxOrderNum + 1;
    const now = new Date().toISOString();
    const totalPrice = payload.items.reduce(
      (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const cleanedItems = payload.items.map((it) => ({
      menuItemId: it.menuItemId || '',
      name: it.name || '',
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      options: it.options || {},
      specialNote: it.specialNote || '',
    }));

    const finalOrder: Order = {
      id: orderId,
      orderNumber,
      customerName: payload.customerName || 'مشتری گرامی',
      customerPhone: payload.customerPhone || '',
      orderType: payload.orderType,
      tableNumber: payload.orderType === 'dine-in' ? Number(payload.tableNumber) || 1 : undefined,
      items: cleanedItems,
      totalPrice,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      notes: payload.notes || '',
    };

    // 1. Primary: Save to Cloud Firestore
    // This allows customer phone to instantly transmit order to manager laptop on Cloudflare Pages
    try {
      const sanitized = sanitizeForFirestore(finalOrder);
      await setDoc(doc(db, 'orders', finalOrder.id), sanitized);
      console.log('✅ Order successfully saved to Cloud Firestore:', finalOrder.id);
    } catch (fsErr) {
      console.warn('Firestore setDoc notice:', fsErr);
    }

    // 2. Also save to Supabase if configured
    if (supabase && isSupabaseConfigured) {
      try {
        const sbRecord = mapAppOrderToSupabase(finalOrder);
        await supabase.from('orders').upsert([sbRecord], { onConflict: 'id' });
        console.log('✅ Order successfully stored in Supabase:', finalOrder.id);
      } catch (sbErr) {
        console.warn('Error inserting into Supabase orders:', sbErr);
      }
    }

    // 3. Also notify Express backend if running in fullstack mode (with exact same order ID)
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalOrder),
      });
    } catch {}

    // 4. Save to local storage for instant availability
    saveLocalOrders([finalOrder, ...local.filter((o) => o.id !== finalOrder.id)]);
    saveLocalMyOrder(finalOrder);

    return { success: true, order: finalOrder };
  } catch (err: any) {
    console.error('Order creation failed:', err);
    return { success: false, order: null as any, error: err.message || 'خطا در ثبت سفارش' };
  }
}

export async function updateOrderStatusApi(
  orderId: string,
  newStatus: OrderStatus
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Primary: Update in Cloud Firestore
  // Real-time onSnapshot immediately broadcasts status to customer's phone!
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: newStatus,
      updatedAt: now,
    });
    console.log('✅ Order status updated in Firestore:', orderId, newStatus);
  } catch (fsErr) {
    console.warn('Firestore updateDoc status notice:', fsErr);
  }

  // 2. Update in Supabase
  if (supabase && isSupabaseConfigured) {
    try {
      await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: now })
        .eq('id', orderId);
    } catch (e) {
      console.warn('Error updating status in Supabase:', e);
    }
  }

  // 3. Notify Express backend if present
  try {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  } catch {}

  // 4. Update local storage
  const local = getLocalOrders();
  const updated = local.map((o) =>
    o.id === orderId ? { ...o, status: newStatus, updatedAt: now } : o
  );
  saveLocalOrders(updated);
  updateLocalMyOrderStatus(orderId, newStatus);

  return true;
}

export async function clearAllOrdersApi(): Promise<boolean> {
  // 1. Primary: Clear Cloud Firestore orders
  try {
    const ordersCol = collection(db, 'orders');
    const snapshot = await getDocs(ordersCol);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log('✅ Firestore orders collection cleared');
    }
  } catch (fsErr) {
    console.warn('Firestore clear orders error:', fsErr);
  }

  // 2. Clear Supabase
  if (supabase && isSupabaseConfigured) {
    try {
      await supabase.from('orders').delete().neq('id', '');
    } catch (e) {}
  }

  // 3. Clear Express
  try {
    await fetch('/api/orders/all', { method: 'DELETE' });
  } catch {}

  saveLocalOrders([]);
  try {
    localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_MY_ORDERS_KEY);
  } catch {}

  return true;
}

// Lookup order by ID, OrderNumber, or Phone
export async function lookupOrderApi(queryStr: string): Promise<Order | null> {
  const raw = queryStr.trim();
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/^(pc-|#pc-)/i, '').trim();

  // 1. Check local memory
  const local = getLocalOrders();
  const foundLocal = local.find(
    (o) =>
      o.id.toLowerCase() === raw.toLowerCase() ||
      String(o.orderNumber) === clean ||
      String(o.orderNumber) === raw ||
      (o.customerPhone && o.customerPhone.includes(raw))
  );
  if (foundLocal) return foundLocal;

  // 2. Check Cloud Firestore
  try {
    const ordersCol = collection(db, 'orders');

    // Direct doc ID
    try {
      const docSnap = await getDoc(doc(db, 'orders', raw));
      if (docSnap.exists()) {
        return { ...(docSnap.data() as Order), id: docSnap.id };
      }
    } catch {}

    // By order number
    const numQuery = Number(clean);
    if (!isNaN(numQuery) && numQuery > 0) {
      const qNum = query(ordersCol, where('orderNumber', '==', numQuery));
      const snapNum = await getDocs(qNum);
      if (!snapNum.empty) {
        const d = snapNum.docs[0];
        return { ...(d.data() as Order), id: d.id };
      }
    }

    // By phone
    if (raw.length >= 4) {
      const qPhone = query(ordersCol, where('customerPhone', '==', raw));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        const d = snapPhone.docs[0];
        return { ...(d.data() as Order), id: d.id };
      }
    }
  } catch (fsErr) {
    console.warn('Firestore lookup error:', fsErr);
  }

  // 3. Fallback to Express backend
  try {
    const res = await fetch(`/api/orders/lookup/${encodeURIComponent(raw)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.order) return data.order;
    }
  } catch {}

  return null;
}

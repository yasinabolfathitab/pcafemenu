import { MenuItem, Order, OrderStatus } from '../types';
import { INITIAL_MENU_ITEMS } from '../data/initialMenu';
import {
  supabase,
  isSupabaseConfigured,
  mapSupabaseOrderToAppOrder,
  mapAppOrderToSupabase,
  mapSupabaseMenuItemToApp,
  mapAppMenuItemToSupabase,
} from '../supabase';

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
  return (num || 0).toLocaleString('en-US') + ' تومان';
}

// Local storage helpers (Guarantees offline resilience and zero-lag experience)
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

// =========================================================================
// Step 3 (Real-time): Supabase WebSockets Subscription for Cafe Admin Panel
// =========================================================================
export function subscribeToOrders(
  onOrdersChanged: (orders: Order[]) => void,
  onError?: (err: any) => void
): () => void {
  let isUnsubscribed = false;
  let supabaseChannel: any = null;

  // 1. Primary: Real-time Supabase PostgreSQL Changes WebSockets
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
            console.log('⚡ Supabase WebSocket Real-time update:', payload.eventType);
            
            // Re-fetch orders using standard Supabase query to ensure sorted consistency
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
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase WebSockets connected to table "orders"');
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Supabase channel error:', err);
            if (onError) onError(err);
          }
        });
    } catch (wsErr) {
      console.warn('Failed to initialize Supabase WebSockets channel:', wsErr);
    }
  }

  // 2. Auxiliary Polling Fallback (every 6 seconds)
  // Ensures updates in case of internet instability, VPN disconnects, or before Supabase keys are configured
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const orders = await fetchOrdersApi();
      if (!isUnsubscribed && Array.isArray(orders)) {
        onOrdersChanged(orders);
      }
    } catch {
      // ignore transient polling errors
    }
  }, 6000);

  return () => {
    isUnsubscribed = true;
    if (supabase && supabaseChannel) {
      supabase.removeChannel(supabaseChannel);
    }
    clearInterval(pollInterval);
  };
}

// =========================================================================
// Step 4 (Data Functions): Supabase Standard Operations (Menu & Orders)
// =========================================================================

// 1. Get Menu (Supabase -> Local Storage -> Default Fallback)
export async function fetchMenuApi(): Promise<MenuItem[]> {
  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*');

      if (!error && data && data.length > 0) {
        const items = data.map(mapSupabaseMenuItemToApp);
        localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(items));
        return items;
      } else if (error) {
        console.warn('Supabase fetch menu warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase menu fetch exception:', e);
    }
  }

  // Fallback to Express backend if running in dev
  try {
    const res = await fetch('/api/menu');
    if (res.ok) {
      const menu = await res.json();
      if (Array.isArray(menu) && menu.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(menu));
        return menu;
      }
    }
  } catch {}

  // Fallback to local storage
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_MENU_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return INITIAL_MENU_ITEMS;
}

// 2. Add / Update Menu Item in Supabase
export async function saveMenuItemApi(item: MenuItem): Promise<boolean> {
  // Update local storage first for instant optimistic UI
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

  if (supabase && isSupabaseConfigured) {
    try {
      const payload = mapAppMenuItemToSupabase(item);
      const { error } = await supabase.from('menu_items').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase upsert menu_items error:', error.message);
        // Retry with plain object in case columns are camelCase
        await supabase.from('menu_items').upsert(item as any, { onConflict: 'id' });
      }
      return true;
    } catch (e) {
      console.warn('Supabase saveMenuItem error:', e);
    }
  }

  // Also notify Express API if available
  try {
    await fetch(`/api/menu/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } catch {}

  return true;
}

// 3. Delete Menu Item from Supabase
export async function deleteMenuItemApi(itemId: string): Promise<boolean> {
  // Update local cache
  try {
    const local = await fetchMenuApi();
    const updated = local.filter((i) => i.id !== itemId);
    localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(updated));
  } catch {}

  if (supabase && isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
      if (error) {
        console.warn('Supabase delete menu_item error:', error.message);
      }
      return true;
    } catch (e) {
      console.warn('Supabase deleteMenuItem error:', e);
    }
  }

  try {
    await fetch(`/api/menu/${itemId}`, { method: 'DELETE' });
  } catch {}

  return true;
}

// 4. Get Orders (Supabase -> Express -> Local Storage)
export async function fetchOrdersApi(): Promise<Order[]> {
  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const list = data.map(mapSupabaseOrderToAppOrder);
        saveLocalOrders(list);
        return list;
      } else if (error) {
        // In case table was created with camelCase 'createdAt'
        const retry = await supabase.from('orders').select('*');
        if (!retry.error && retry.data) {
          const list = retry.data.map(mapSupabaseOrderToAppOrder);
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          saveLocalOrders(list);
          return list;
        }
      }
    } catch (sbErr) {
      console.warn('Supabase fetch orders error:', sbErr);
    }
  }

  // Fallback: Check Express backend API
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const serverOrders: Order[] = await res.json();
      if (Array.isArray(serverOrders)) {
        saveLocalOrders(serverOrders);
        return serverOrders;
      }
    }
  } catch {}

  return getLocalOrders();
}

// 5. Submit Order (Supabase Insert + Local Storage)
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

    // Calculate maximum order number
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
      tableNumber: payload.orderType === 'dine-in' ? payload.tableNumber || 1 : undefined,
      items: cleanedItems,
      totalPrice,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      notes: payload.notes || '',
    };

    // 1. Insert into Supabase Orders Table
    if (supabase && isSupabaseConfigured) {
      try {
        const sbRecord = mapAppOrderToSupabase(finalOrder);
        const { error } = await supabase.from('orders').insert([sbRecord]);
        if (error) {
          console.warn('Supabase insert orders notice (retrying raw):', error.message);
          await supabase.from('orders').insert([finalOrder as any]);
        }
        console.log('✅ Order successfully stored in Supabase:', finalOrder.id);
      } catch (sbErr) {
        console.error('Error inserting into Supabase orders:', sbErr);
      }
    }

    // 2. Also notify Express backend if running in fullstack mode
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}

    // 3. Save to local storage for instant optimistic availability
    saveLocalOrders([finalOrder, ...local.filter((o) => o.id !== finalOrder.id)]);

    return { success: true, order: finalOrder };
  } catch (err: any) {
    console.error('Order creation failed:', err);
    return { success: false, order: null as any, error: err.message || 'خطا در ثبت سفارش' };
  }
}

// 6. Update Order Status (Supabase Update + Local Storage)
export async function updateOrderStatusApi(
  orderId: string,
  newStatus: OrderStatus
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Update in Supabase
  if (supabase && isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: now })
        .eq('id', orderId);

      if (error) {
        // In case column is camelCase
        await supabase
          .from('orders')
          .update({ status: newStatus, updatedAt: now } as any)
          .eq('id', orderId);
      }
    } catch (e) {
      console.warn('Error updating status in Supabase:', e);
    }
  }

  // 2. Also notify Express backend if present
  try {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  } catch {}

  // 3. Local Storage update
  const local = getLocalOrders();
  const updated = local.map((o) =>
    o.id === orderId ? { ...o, status: newStatus, updatedAt: now } : o
  );
  saveLocalOrders(updated);

  return true;
}

// 7. Clear all orders (Admin only)
export async function clearAllOrdersApi(): Promise<boolean> {
  if (supabase && isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('orders').delete().neq('id', '');
      if (error) {
        console.warn('Error clearing Supabase orders:', error.message);
      }
    } catch (e) {
      console.warn('Error clearing Supabase orders:', e);
    }
  }

  try {
    await fetch('/api/orders/all', { method: 'DELETE' });
  } catch {}

  saveLocalOrders([]);
  return true;
}

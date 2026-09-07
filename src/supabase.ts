import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MenuItem, Order, OrderStatus } from './types';

// Step 2 (Security): Read environment variables safely from Vite & environment
const metaEnv = (import.meta as any)?.env || {};
const rawUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL : '') ||
  '';

const rawAnonKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY : '') ||
  '';

export const SUPABASE_URL = (rawUrl || '').trim();
export const SUPABASE_ANON_KEY = (rawAnonKey || '').trim();

export const isSupabaseConfigured: boolean = Boolean(
  SUPABASE_URL &&
  SUPABASE_URL.startsWith('http') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('your-anon-key') &&
  !SUPABASE_ANON_KEY.includes('your-supabase-anon-key')
);

if (!isSupabaseConfigured) {
  console.info(
    'ℹ️ Supabase credentials not set or placeholder used. Running in standalone local-storage & offline mode until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided.'
  );
}

// Step 1: Create and export the Supabase client
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// ==========================================
// Helpers: Map between App Types and Supabase Tables
// Handles both snake_case (standard PostgreSQL) & camelCase
// ==========================================

export function mapSupabaseOrderToAppOrder(row: any): Order {
  let items = row.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }

  return {
    id: String(row.id),
    orderNumber: Number(row.order_number ?? row.orderNumber ?? 1000),
    customerName: String(row.customer_name ?? row.customerName ?? 'مشتری گرامی'),
    customerPhone: row.customer_phone ?? row.customerPhone ?? undefined,
    orderType: (row.order_type ?? row.orderType ?? 'dine-in') as 'dine-in' | 'takeaway',
    tableNumber: row.table_number ?? row.tableNumber ?? undefined,
    items: Array.isArray(items) ? items : [],
    totalPrice: Number(row.total_price ?? row.totalPrice ?? 0),
    status: (row.status ?? 'pending') as OrderStatus,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
    notes: row.notes ?? undefined,
  };
}

export function mapAppOrderToSupabase(order: Order): Record<string, any> {
  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_name: order.customerName,
    customer_phone: order.customerPhone || null,
    order_type: order.orderType,
    table_number: order.tableNumber || null,
    items: order.items,
    total_price: order.totalPrice,
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    notes: order.notes || null,
  };
}

export function mapSupabaseMenuItemToApp(row: any): MenuItem {
  let ingredients = row.ingredients;
  if (typeof ingredients === 'string') {
    try {
      ingredients = JSON.parse(ingredients);
    } catch {
      ingredients = row.ingredients.split(',').map((s: string) => s.trim());
    }
  }

  let options = row.customization_options ?? row.customizationOptions;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch {
      options = undefined;
    }
  }

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    enName: String(row.en_name ?? row.enName ?? ''),
    category: row.category,
    price: Number(row.price ?? 0),
    description: String(row.description ?? ''),
    ingredients: Array.isArray(ingredients) ? ingredients : [],
    image: String(row.image ?? ''),
    prepTime: Number(row.prep_time ?? row.prepTime ?? 5),
    calories: row.calories ? Number(row.calories) : undefined,
    isPopular: Boolean(row.is_popular ?? row.isPopular),
    isSpecial: Boolean(row.is_special ?? row.isSpecial),
    isAvailable: row.is_available !== undefined ? Boolean(row.is_available) : (row.isAvailable !== undefined ? Boolean(row.isAvailable) : true),
    customizationOptions: options,
  };
}

export function mapAppMenuItemToSupabase(item: MenuItem): Record<string, any> {
  return {
    id: item.id,
    name: item.name,
    en_name: item.enName,
    category: item.category,
    price: item.price,
    description: item.description,
    ingredients: item.ingredients,
    image: item.image,
    prep_time: item.prepTime,
    calories: item.calories || null,
    is_popular: Boolean(item.isPopular),
    is_special: Boolean(item.isSpecial),
    is_available: Boolean(item.isAvailable),
    customization_options: item.customizationOptions || null,
  };
}

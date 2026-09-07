-- =========================================================
-- P CAFE (کافه پی) - SUPABASE DATABASE SCHEMA & REALTIME SETUP
-- Run this SQL in your Supabase Project -> SQL Editor
-- =========================================================

-- 1. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number BIGINT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT 'مشتری گرامی',
    customer_phone TEXT,
    order_type TEXT NOT NULL DEFAULT 'dine-in',
    table_number TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_price NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    notes TEXT
);

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- 2. Create Menu Items Table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    en_name TEXT,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    ingredients JSONB DEFAULT '[]'::jsonb,
    image TEXT,
    prep_time INTEGER DEFAULT 5,
    calories INTEGER,
    is_popular BOOLEAN DEFAULT false,
    is_special BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    customization_options JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Enable Row Level Security (RLS) & Public Policies for P Cafe App
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for cafe customers and staff
CREATE POLICY "Allow public read on orders" 
ON public.orders FOR SELECT USING (true);

CREATE POLICY "Allow public insert on orders" 
ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on orders" 
ON public.orders FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on orders" 
ON public.orders FOR DELETE USING (true);

-- Menu items policies
CREATE POLICY "Allow public read on menu_items" 
ON public.menu_items FOR SELECT USING (true);

CREATE POLICY "Allow public insert on menu_items" 
ON public.menu_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on menu_items" 
ON public.menu_items FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on menu_items" 
ON public.menu_items FOR DELETE USING (true);

-- 4. Enable Supabase Realtime (WebSockets) on Orders table
-- This enables instant live order notifications in Admin Panel without page refresh!
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'menu_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
  END IF;
END $$;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom enum types (only if they don't exist)
DO $$ BEGIN
    CREATE TYPE product_category AS ENUM ('fruits', 'vegetables', 'dairy', 'meat', 'grains', 'herbs');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vendor_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create vendor_profiles table
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  farm_name TEXT NOT NULL,
  farm_description TEXT,
  location TEXT,
  id_number TEXT,
  status vendor_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category product_category NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  image_urls TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  status order_status NOT NULL DEFAULT 'pending',
  delivery_address TEXT,
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
  total_price DECIMAL(10,2) NOT NULL CHECK (total_price > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vendor_profiles
CREATE POLICY "Vendors can view their own profile" ON public.vendor_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Vendors can update their own profile" ON public.vendor_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Vendors can insert their own profile" ON public.vendor_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view approved vendors" ON public.vendor_profiles
  FOR SELECT USING (status = 'approved');

-- Create RLS policies for products
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can manage their own products" ON public.products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp 
      WHERE vp.id = vendor_id AND vp.user_id = auth.uid()
    )
  );

-- Create RLS policies for orders
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Users can update their own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = customer_id);

-- Create RLS policies for order_items
CREATE POLICY "Users can view items in their orders" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items in their orders" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Vendors can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Vendors can update their product images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images');

-- Insert sample vendor profiles and products
INSERT INTO public.vendor_profiles (id, user_id, farm_name, farm_description, location, status) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Sunny Valley Farm', 'Organic vegetables and fruits', 'Valley County', 'approved'),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Green Meadows', 'Fresh dairy and meat products', 'Meadow City', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (vendor_id, name, description, category, price, stock_quantity, unit, is_active) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', 'Fresh Tomatoes', 'Organic red tomatoes, locally grown', 'vegetables', 3.50, 100, 'kg', true),
  ('660e8400-e29b-41d4-a716-446655440001', 'Sweet Apples', 'Crisp and sweet red apples', 'fruits', 4.00, 50, 'kg', true),
  ('660e8400-e29b-41d4-a716-446655440002', 'Fresh Milk', 'Farm fresh whole milk', 'dairy', 2.50, 30, 'liter', true),
  ('660e8400-e29b-41d4-a716-446655440002', 'Free Range Eggs', 'Fresh eggs from free-range chickens', 'dairy', 5.00, 200, 'dozen', true)
ON CONFLICT (id) DO NOTHING;
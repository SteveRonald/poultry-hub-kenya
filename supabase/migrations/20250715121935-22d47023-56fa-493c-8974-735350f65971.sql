
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin');
CREATE TYPE product_category AS ENUM ('chickens', 'eggs', 'feed', 'equipment', 'medicine', 'chicks');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE vendor_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role DEFAULT 'customer',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create vendor profiles table
CREATE TABLE public.vendor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  farm_name TEXT NOT NULL,
  farm_description TEXT,
  location TEXT NOT NULL,
  id_number TEXT,
  status vendor_status DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category product_category NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'piece',
  image_urls TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES auth.users ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendor_profiles(id),
  total_amount DECIMAL(10,2) NOT NULL,
  status order_status DEFAULT 'pending',
  delivery_address TEXT,
  delivery_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for vendor_profiles
CREATE POLICY "Vendors can view their own profile" ON public.vendor_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Vendors can update their own profile" ON public.vendor_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Vendors can insert their own profile" ON public.vendor_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all vendor profiles" ON public.vendor_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update vendor profiles" ON public.vendor_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for products
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can manage their own products" ON public.products
  FOR ALL USING (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for orders
CREATE POLICY "Customers can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Vendors can view orders for their products" ON public.orders
  FOR SELECT USING (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- RLS Policies for order_items
CREATE POLICY "Users can view order items for their orders" ON public.order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE customer_id = auth.uid() OR vendor_id IN (
        SELECT id FROM public.vendor_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert order items for their orders" ON public.order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE customer_id = auth.uid()
    )
  );

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true);

-- Storage policies for product images
CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Vendors can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Vendors can update their product images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Insert sample products with real poultry images
INSERT INTO public.vendor_profiles (user_id, farm_name, farm_description, location, status) VALUES
  (gen_random_uuid(), 'Green Valley Poultry Farm', 'Organic free-range chicken and eggs', 'Kiambu County', 'approved'),
  (gen_random_uuid(), 'Sunshine Feeds Ltd', 'Quality poultry feeds and supplements', 'Nairobi County', 'approved'),
  (gen_random_uuid(), 'Heritage Hatchery', 'Premium chicken breeds and chicks', 'Nakuru County', 'approved');

-- Insert sample products
INSERT INTO public.products (vendor_id, name, description, category, price, stock_quantity, unit, image_urls, is_active) VALUES
  (
    (SELECT id FROM public.vendor_profiles WHERE farm_name = 'Green Valley Poultry Farm'),
    'Free Range Kienyeji Chicken',
    'Healthy free-range indigenous chickens raised without antibiotics. Perfect for meat and egg production.',
    'chickens',
    1500.00,
    50,
    'piece',
    ARRAY['https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800', 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800'],
    true
  ),
  (
    (SELECT id FROM public.vendor_profiles WHERE farm_name = 'Green Valley Poultry Farm'),
    'Fresh Brown Eggs (Tray of 30)',
    'Fresh organic brown eggs from free-range hens. Rich in nutrients and perfect for cooking.',
    'eggs',
    450.00,
    100,
    'tray',
    ARRAY['https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800', 'https://images.unsplash.com/photo-1606997271009-66e7cd4c2157?w=800'],
    true
  ),
  (
    (SELECT id FROM public.vendor_profiles WHERE farm_name = 'Sunshine Feeds Ltd'),
    'Layers Mash Feed (50kg)',
    'High-quality layers mash with balanced nutrition for optimal egg production. Contains essential vitamins and minerals.',
    'feed',
    2800.00,
    200,
    'bag',
    ARRAY['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800'],
    true
  ),
  (
    (SELECT id FROM public.vendor_profiles WHERE farm_name = 'Heritage Hatchery'),
    'Day Old Chicks - Rhode Island Red',
    'Healthy day-old Rhode Island Red chicks. Known for excellent egg production and hardy nature.',
    'chicks',
    120.00,
    300,
    'piece',
    ARRAY['https://images.unsplash.com/photo-1613788544447-9c9c2c6a3f65?w=800', 'https://images.unsplash.com/photo-1571152942548-5a51b8ded9e4?w=800'],
    true
  ),
  (
    (SELECT id FROM public.vendor_profiles WHERE farm_name = 'Sunshine Feeds Ltd'),
    'Automatic Poultry Feeder',
    'Durable automatic feeder system that reduces waste and ensures consistent feeding. Suitable for 50-100 birds.',
    'equipment',
    3500.00,
    25,
    'piece',
    ARRAY['https://images.unsplash.com/photo-1594736797933-d0c9c33cb5cd?w=800'],
    true
  ),
  (
    (SELECT id FROM public.vendor_profiles WHERE farm_name = 'Green Valley Poultry Farm'),
    'Broiler Chickens (Ready for Market)',
    'Well-fed broiler chickens ready for slaughter. Average weight 2.5-3kg. Raised on quality feed.',
    'chickens',
    800.00,
    30,
    'piece',
    ARRAY['https://images.unsplash.com/photo-1562818232-e7171cb44c57?w=800'],
    true
  );

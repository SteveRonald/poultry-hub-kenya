-- Add RLS policies for products table to allow public read access
CREATE POLICY "products_public_read" 
ON public.products 
FOR SELECT 
USING (true);

-- Add RLS policies for vendor_profiles table to allow public read access
CREATE POLICY "vendor_profiles_public_read" 
ON public.vendor_profiles 
FOR SELECT 
USING (true);

-- Add RLS policies for orders table to allow users to view their own orders
CREATE POLICY "orders_buyer_access" 
ON public.orders 
FOR ALL 
USING (auth.uid() = buyer_id);

CREATE POLICY "orders_vendor_access" 
ON public.orders 
FOR ALL 
USING (auth.uid() = vendor_id);

-- Add RLS policies for order_items table
CREATE POLICY "order_items_access" 
ON public.order_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())
  )
);

-- Insert some sample products and vendor profiles for testing
INSERT INTO public.vendor_profiles (user_id, farm_name, location, farm_description, phone, id_number, status) VALUES 
('00000000-0000-0000-0000-000000000001', 'Sunrise Poultry Farm', 'Nairobi', 'Premium poultry and egg production farm', '+254712345678', 'ID12345678', 'approved'),
('00000000-0000-0000-0000-000000000002', 'Green Valley Farms', 'Kiambu', 'Organic chicken and egg farming', '+254787654321', 'ID87654321', 'approved'),
('00000000-0000-0000-0000-000000000003', 'Happy Hens Farm', 'Machakos', 'Quality broiler and layer chicken production', '+254723456789', 'ID23456789', 'approved');

-- Insert sample products
INSERT INTO public.products (vendor_id, name, description, category, price, stock_quantity, unit, image_url, is_available) VALUES 
((SELECT id FROM public.vendor_profiles WHERE farm_name = 'Sunrise Poultry Farm'), 'Day Old Chicks - Kienyeji', 'Healthy day old indigenous chicken chicks', 'chicks', 150, 500, 'piece', 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800', true),
((SELECT id FROM public.vendor_profiles WHERE farm_name = 'Sunrise Poultry Farm'), 'Fresh Farm Eggs', 'Fresh eggs from free-range chickens', 'eggs', 20, 200, 'tray', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800', true),
((SELECT id FROM public.vendor_profiles WHERE farm_name = 'Green Valley Farms'), 'Broiler Chicks', 'Fast-growing broiler chicken chicks', 'chicks', 120, 300, 'piece', 'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?w=800', true),
((SELECT id FROM public.vendor_profiles WHERE farm_name = 'Green Valley Farms'), 'Layer Chicken Feed', 'Nutritious feed for laying hens', 'feed', 3500, 50, 'bag', 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800', true),
((SELECT id FROM public.vendor_profiles WHERE farm_name = 'Happy Hens Farm'), 'Mature Layers', 'Ready to lay hens - 5 months old', 'chickens', 2500, 100, 'piece', 'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?w=800', true),
((SELECT id FROM public.vendor_profiles WHERE farm_name = 'Happy Hens Farm'), 'Poultry Vitamins', 'Essential vitamins for healthy chickens', 'medicine', 850, 75, 'bottle', 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800', true);
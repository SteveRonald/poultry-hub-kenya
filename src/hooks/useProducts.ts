
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock_quantity: number;
  unit: string;
  image_urls: string[];
  is_active: boolean;
  vendor_profiles: {
    farm_name: string;
    location: string;
  };
}

export const useProducts = (searchTerm?: string, category?: string, location?: string) => {
  return useQuery({
    queryKey: ['products', searchTerm, category, location],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          vendor_profiles!inner(
            farm_name,
            location
          )
        `)
        .eq('is_active', true);

      // Apply filters
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,vendor_profiles.farm_name.ilike.%${searchTerm}%`);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (location && location !== 'all') {
        query = query.eq('vendor_profiles.location', location);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      return data as Product[];
    },
  });
};

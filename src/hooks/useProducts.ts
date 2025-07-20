
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
  image_url: string;
  is_available: boolean;
  vendor_profiles: {
    farm_name: string;
    location: string;
  };
}

export const useProducts = (searchTerm?: string, category?: string, location?: string) => {
  return useQuery({
    queryKey: ['products', searchTerm, category, location],
    queryFn: async () => {
      let query = (supabase as any)
        .from('products')
        .select(`
          *,
          vendor_profiles (
            farm_name,
            location
          )
        `)
        .eq('is_available', true);

      // Apply filters
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%`);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      // Filter by location if specified
      let filteredData = data || [];
      if (location && location !== 'all') {
        filteredData = filteredData.filter((product: any) => 
          product.vendor_profiles?.location === location
        );
      }

      // Filter by search term in vendor farm name if specified
      if (searchTerm) {
        filteredData = filteredData.filter((product: any) => 
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.vendor_profiles?.farm_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return filteredData as any[];
    },
  });
};

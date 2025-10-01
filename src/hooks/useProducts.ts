
import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '../config/api';
// Removed: import { supabase } from '@/integrations/supabase/client';

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
  return useQuery<Product[]>({
    queryKey: ['products', searchTerm, category, location],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      let url = getApiUrl('/api/products');
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (category && category !== 'all') params.append('category', category);
      if (location && location !== 'all') params.append('location', location);
      if ([...params].length) url += `?${params.toString()}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      return data;
    },
  });
};

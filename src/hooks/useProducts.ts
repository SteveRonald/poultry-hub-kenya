
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
  minimum_order_quantity?: number;
  unit: string;
  // primary image (may be a URL or null). Some API responses also include `image_urls` (array or JSON-stringified array).
  image_url?: string | null;
  image_urls?: string | string[];
  is_available: boolean;
  average_rating?: number;
  total_ratings?: number;
  // vendor_profiles sometimes contains additional fields depending on the API response
  vendor_profiles: {
    farm_name: string;
    location: string;
    user_id?: string;
  };
  // vendor_id references the vendors table; vendor_user_id may occasionally be present
  vendor_id?: string;
  vendor_user_id?: string;
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

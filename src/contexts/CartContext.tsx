import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiUrl } from '../config/api';
import { toast } from 'sonner';

interface CartItem {
  cart_id: number;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  total_price: number;
  stock_quantity: number;
  unit: string;
  image_url: string | null;
  category: string;
  vendor_name: string;
  vendor_phone: string;
  added_at: string;
}

interface CartSummary {
  total_items: number;
  total_amount: number;
  items_count: number;
}

interface CartContextType {
  cartItems: CartItem[];
  cartSummary: CartSummary;
  loading: boolean;
  addToCart: (productId: string, quantity: number) => Promise<boolean>;
  updateCartItem: (cartId: number, quantity: number) => Promise<boolean>;
  removeFromCart: (cartId: number) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartSummary, setCartSummary] = useState<CartSummary>({
    total_items: 0,
    total_amount: 0,
    items_count: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchCart = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCartItems([]);
      setCartSummary({ total_items: 0, total_amount: 0, items_count: 0 });
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/cart'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCartItems(data.items || []);
        setCartSummary(data.summary || { total_items: 0, total_amount: 0, items_count: 0 });
      } else {
        console.error('Failed to fetch cart');
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const addToCart = async (productId: string, quantity: number): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to add items to cart');
      return false;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/cart'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: quantity
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchCart(); // Refresh cart
        return true;
      } else {
        toast.error(data.error || 'Failed to add item to cart');
        return false;
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add item to cart');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateCartItem = async (cartId: number, quantity: number): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to update cart');
      return false;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/cart'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cart_id: cartId,
          quantity: quantity
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchCart(); // Refresh cart
        return true;
      } else {
        toast.error(data.error || 'Failed to update cart item');
        return false;
      }
    } catch (error) {
      console.error('Error updating cart item:', error);
      toast.error('Failed to update cart item');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (cartId: number): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to remove items from cart');
      return false;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/cart'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cart_id: cartId
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchCart(); // Refresh cart
        return true;
      } else {
        toast.error(data.error || 'Failed to remove item from cart');
        return false;
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      toast.error('Failed to remove item from cart');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to clear cart');
      return false;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/cart/clear'), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchCart(); // Refresh cart
        return true;
      } else {
        toast.error(data.error || 'Failed to clear cart');
        return false;
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('Failed to clear cart');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const refreshCart = async () => {
    await fetchCart();
  };

  // Fetch cart on mount and when token changes
  useEffect(() => {
    fetchCart();
  }, []);

  const value: CartContextType = {
    cartItems,
    cartSummary,
    loading,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    refreshCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};


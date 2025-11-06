
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
// Removed: import { supabase } from '@/integrations/supabase/client';
// Removed: import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'vendor' | 'admin';
  phone?: string;
  isApproved?: boolean;
  vendorData?: {
    status: string;
    farm_name: string;
    farm_description: string;
    location: string;
    id_number: string;
  };
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  fetchUser: async () => {},
  isLoading: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to get token
  const getToken = () => localStorage.getItem('token');

  // Fetch user profile from backend
  const fetchUser = async () => {
    const token = getToken();
    if (!token) {
        setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/users/me'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Only remove token on 401 (unauthorized) - but verify it's actually expired
      if (res.status === 401) {
        // Double-check: try to get token from localStorage
        const currentToken = localStorage.getItem('token');
        if (currentToken === token) {
          // Token is the same, so it's actually expired
          setUser(null);
          localStorage.removeItem('token');
        }
        setIsLoading(false);
        return;
      }
      
      if (!res.ok) {
        // For other errors, keep the token and user state
        // Don't clear user on temporary errors (500, 503, etc.)
        setIsLoading(false);
        return;
      }
      
      const data = await res.json();
        setUser({
        id: data.id,
        email: data.email,
        name: data.full_name,
        role: data.role,
        phone: data.phone,
        isApproved: data.isApproved,
        vendorData: data.vendorData,
      });
    } catch (err) {
      // Network errors - don't remove token or clear user, might be temporary
      // Keep the existing user state if available
      // Only log in dev mode
      if (import.meta.env.DEV) {
        console.error('Failed to fetch user:', err);
      }
      // Don't clear user on network errors - keep existing state
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // Only fetch user if we don't have one yet
    // This prevents clearing user state on page refresh if token is valid
    if (!user) {
      fetchUser();
    } else {
      // If we already have a user, just set loading to false
      setIsLoading(false);
    }
    // eslint-disable-next-line
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Invalid credentials');
      }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.full_name,
        role: data.user.role,
        phone: data.user.phone,
        isApproved: data.user.isApproved,
        vendorData: data.user.vendorData,
      });
      
      // Return user data for navigation logic
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: any) => {
    setIsLoading(true);
    try {
      // Map name to full_name for backend compatibility
      const payload = {
        ...userData,
        full_name: userData.name,
        phone: userData.phone,
        // Always send vendor fields for backend compatibility
        farm_name: userData.farmName || '',
        farm_description: userData.farmDescription || '',
        location: userData.location || '',
        id_number: userData.idNumber || '',
      };
      delete payload.name;
      delete payload.farmName;
      delete payload.farmDescription;
      delete payload.idNumber;
      const res = await fetch(getApiUrl('/api/users/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Registration failed');
      // Optionally auto-login after registration
      await login(userData.email, userData.password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, fetchUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

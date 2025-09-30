
import React, { createContext, useContext, useEffect, useState } from 'react';
// Removed: import { supabase } from '@/integrations/supabase/client';
// Removed: import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'vendor' | 'admin';
  phone?: string;
  isApproved?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
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
      const res = await fetch('http://localhost/poultry-hub-kenya/backend/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      const data = await res.json();
        setUser({
        id: data.id,
        email: data.email,
        name: data.full_name,
        role: data.role,
        phone: data.phone,
        isApproved: data.isApproved,
      });
    } catch (err) {
      setUser(null);
      localStorage.removeItem('token');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost/poultry-hub-kenya/backend/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      localStorage.setItem('token', data.token);
      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.full_name,
        role: data.user.role,
        phone: data.user.phone,
        isApproved: data.user.isApproved,
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
      const res = await fetch('http://localhost/poultry-hub-kenya/backend/api/users/register', {
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
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

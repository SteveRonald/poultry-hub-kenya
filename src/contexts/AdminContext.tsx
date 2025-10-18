import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminInfo {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
}

interface AdminContextType {
  admin: AdminInfo | null;
  isAuthenticated: boolean;
  login: (adminData: AdminInfo, token: string) => void;
  logout: () => void;
  updateAdmin: (adminData: AdminInfo) => void;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

interface AdminProviderProps {
  children: ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing admin session
    const token = localStorage.getItem('admin_session_token');
    const adminData = localStorage.getItem('admin_info');
    
    if (token && adminData) {
      try {
        const parsedAdmin = JSON.parse(adminData);
        setAdmin(parsedAdmin);
      } catch (error) {
        // Invalid admin data, clear it
        localStorage.removeItem('admin_session_token');
        localStorage.removeItem('admin_info');
      }
    }
    
    setLoading(false);
  }, []);

  const login = (adminData: AdminInfo, token: string) => {
    localStorage.setItem('admin_session_token', token);
    localStorage.setItem('admin_info', JSON.stringify(adminData));
    setAdmin(adminData);
  };

  const logout = () => {
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_info');
    setAdmin(null);
  };

  const updateAdmin = (adminData: AdminInfo) => {
    localStorage.setItem('admin_info', JSON.stringify(adminData));
    setAdmin(adminData);
  };

  const value: AdminContextType = {
    admin,
    isAuthenticated: !!admin,
    login,
    logout,
    updateAdmin,
    loading
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

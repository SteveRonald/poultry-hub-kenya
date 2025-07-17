
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeOrders: 0,
    totalSpent: 0,
  });

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    try {
      const { data: orders, error } = await (supabase as any)
        .from('orders')
        .select('total_amount, status')
        .eq('customer_id', user?.id);

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      const totalOrders = orders?.length || 0;
      const activeOrders = orders?.filter((order: any) => 
        ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status)
      ).length || 0;
      const totalSpent = orders?.reduce((sum: number, order: any) => sum + Number(order.total_amount), 0) || 0;

      setStats({
        totalOrders,
        activeOrders,
        totalSpent,
      });
    } catch (error) {
      console.error('Error in fetchUserStats:', error);
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to role-specific dashboard
  if (user.role === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }

  if (user.role === 'vendor') {
    return <Navigate to="/vendor-dashboard" replace />;
  }

  // Customer dashboard
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Welcome back, {user.name}!</h1>
            <p className="text-gray-600 mt-2">Manage your orders and explore our marketplace</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-primary mb-2">My Orders</h3>
              <p className="text-gray-600 mb-4">Track your recent purchases</p>
              <div className="text-2xl font-bold text-accent">{stats.activeOrders}</div>
              <p className="text-sm text-gray-500">Active orders</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-primary mb-2">Total Orders</h3>
              <p className="text-gray-600 mb-4">All your purchases</p>
              <div className="text-2xl font-bold text-accent">{stats.totalOrders}</div>
              <p className="text-sm text-gray-500">Completed orders</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-primary mb-2">Account Status</h3>
              <p className="text-gray-600 mb-4">Your account information</p>
              <div className="text-sm">
                <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-primary mb-4">Account Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Role</label>
                <p className="text-gray-900 capitalize">{user.role}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Spent</label>
                <p className="text-gray-900">KSH {stats.totalSpent.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Member Since</label>
                <p className="text-gray-900">Recently joined</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;

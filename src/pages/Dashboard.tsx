
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Dashboard = () => {
  const { user } = useAuth();

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
              <div className="text-2xl font-bold text-accent">0</div>
              <p className="text-sm text-gray-500">Active orders</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-primary mb-2">Favorites</h3>
              <p className="text-gray-600 mb-4">Your saved products</p>
              <div className="text-2xl font-bold text-accent">0</div>
              <p className="text-sm text-gray-500">Saved items</p>
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
            <h2 className="text-xl font-semibold text-primary mb-4">Recent Activity</h2>
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity to display</p>
              <p className="text-sm mt-2">Start by browsing our products!</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;

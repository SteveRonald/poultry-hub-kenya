import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeOrders: 0,
    totalSpent: 0,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [profileForm, setProfileForm] = useState<any>({});
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name, email: user.email, phone: user.phone });
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    const token = localStorage.getItem('token');
    if (!user || !token) return;
    const res = await fetch(`http://localhost:5000/api/orders?user_id=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setOrders(data);
    setStats({
      totalOrders: data.length,
      activeOrders: data.filter((o: any) => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)).length,
      totalSpent: data.reduce((sum: number, o: any) => sum + Number(o.amount || o.total_amount || 0), 0),
    });
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handleProfileSave = async () => {
    const token = localStorage.getItem('token');
    if (!user || !token) return;
    await fetch(`http://localhost:5000/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: profileForm.email,
        full_name: profileForm.name,
        phone: profileForm.phone,
        role: user.role,
      }),
    });
    setEditingProfile(false);
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
            <p className="text-gray-600 mt-2">Manage your orders and profile</p>
          </div>

          {/* Stats */}
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
              <h3 className="text-lg font-semibold text-primary mb-2">Total Spent</h3>
              <p className="text-gray-600 mb-4">Your total spending</p>
              <div className="text-2xl font-bold text-accent">KSH {stats.totalSpent}</div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-primary mb-4">My Orders</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{order.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{order.product_id}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{order.quantity}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{order.status}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{order.created_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Profile Update */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-primary mb-4">Account Details</h2>
            {editingProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500" htmlFor="email">Email</label>
                <input
                  type="email"
                  className="text-gray-900 border border-gray-300 rounded-md p-2"
                  id="email"
                    name="email"
                    value={profileForm.email}
                    onChange={handleProfileChange}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500" htmlFor="name">Name</label>
                  <input
                    type="text"
                    className="text-gray-900 border border-gray-300 rounded-md p-2"
                    id="name"
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileChange}
                />
              </div>
              <div>
                  <label className="text-sm font-medium text-gray-500" htmlFor="phone">Phone</label>
                <input
                  type="text"
                  className="text-gray-900 border border-gray-300 rounded-md p-2"
                    id="phone"
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
                  />
                </div>
                <div className="col-span-3 flex gap-2 mt-4">
                  <button className="bg-primary text-white px-4 py-2 rounded" onClick={handleProfileSave}>Save</button>
                  <button className="bg-gray-300 text-gray-700 px-4 py-2 rounded" onClick={() => setEditingProfile(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500" htmlFor="email">Email</label>
                  <input
                    type="email"
                    className="text-gray-900 border border-gray-300 rounded-md p-2"
                    id="email"
                    value={user.email}
                  readOnly
                />
              </div>
              <div>
                  <label className="text-sm font-medium text-gray-500" htmlFor="name">Name</label>
                <input
                  type="text"
                  className="text-gray-900 border border-gray-300 rounded-md p-2"
                    id="name"
                    value={user.name}
                  readOnly
                />
              </div>
              <div>
                  <label className="text-sm font-medium text-gray-500" htmlFor="phone">Phone</label>
                <input
                  type="text"
                  className="text-gray-900 border border-gray-300 rounded-md p-2"
                    id="phone"
                    value={user.phone}
                  readOnly
                />
                </div>
                <div className="col-span-3 flex gap-2 mt-4">
                  <button className="bg-primary text-white px-4 py-2 rounded" onClick={() => setEditingProfile(true)}>Edit</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
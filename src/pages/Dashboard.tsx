import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Eye, Package, ShoppingCart, TrendingUp, X } from 'lucide-react';
import { getApiUrl } from '../config/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [profileForm, setProfileForm] = useState<any>({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [showViewOrderModal, setShowViewOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showShippingUpdateModal, setShowShippingUpdateModal] = useState(false);
  const [newShippingAddress, setNewShippingAddress] = useState('');
  const [updatingShipping, setUpdatingShipping] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name, email: user.email, phone: user.phone });
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    const token = localStorage.getItem('token');
    if (!user || !token) return;
    try {
      const res = await fetch(getApiUrl('/api/orders'), {
      headers: { Authorization: `Bearer ${token}` },
    });
      
      if (!res.ok) {
        if (import.meta.env.DEV) {
          console.error('API response not ok:', res.status, res.statusText);
        }
        return;
      }
      
      const response = await res.json();
      
      // Handle the API response structure
      const orders = response.success ? response.orders : (Array.isArray(response) ? response : []);
      setOrders(orders);
      
      // Calculate stats from grouped orders
      const totalOrders = orders.length;
      const activeOrders = orders.filter((o: any) => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)).length;
      const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
      const totalSpent = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      
    setStats({
        totalOrders,
        activeOrders,
        pendingOrders,
        totalSpent,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch orders:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'processing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'shipped': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const viewOrder = (order: any) => {
    setSelectedOrder(order);
    setShowViewOrderModal(true);
  };

  const updateShippingAddress = (order: any) => {
    setSelectedOrder(order);
    setNewShippingAddress(order.shipping_address);
    setShowShippingUpdateModal(true);
  };

  const handleShippingUpdate = async () => {
    if (!selectedOrder || !newShippingAddress.trim()) return;
    
    const token = localStorage.getItem('token');
    setUpdatingShipping(true);
    
    try {
      const response = await fetch(getApiUrl(`/api/orders/shipping?id=${selectedOrder.items[0].order_id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shipping_address: newShippingAddress.trim() }),
      });
      
      if (response.ok) {
        // Refresh orders data
        await fetchOrders();
        setShowShippingUpdateModal(false);
        setSelectedOrder(null);
        setNewShippingAddress('');
      } else {
        const error = await response.json();
        if (import.meta.env.DEV) {
          console.error('Failed to update shipping address:', error);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Network error:', error);
      }
    } finally {
      setUpdatingShipping(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handleProfileSave = async () => {
    const token = localStorage.getItem('token');
    if (!user || !token) return;
    await fetch(getApiUrl(`/api/admin/users/${user.id}`), {
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
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8 px-2 sm:px-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">
              Welcome back, {user.name || user.email || 'User'}!
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">Manage your orders and profile</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="text-center">
                  <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-accent mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs sm:text-sm text-gray-600">Total Orders</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{stats.totalOrders}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="text-center">
                  <div className="h-5 w-5 sm:h-6 sm:w-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-1 sm:mb-2">
                    <span className="text-xs text-yellow-800 font-bold">{stats.pendingOrders}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600">Pending Orders</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{stats.pendingOrders}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="text-center">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-accent mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs sm:text-sm text-gray-600">Active Orders</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{stats.activeOrders}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="text-center">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-accent mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs sm:text-sm text-gray-600">Total Spent</p>
                  <p className="text-sm sm:text-lg font-bold text-primary">KSH {stats.totalSpent.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex flex-wrap space-x-2 sm:space-x-8 px-4 sm:px-6">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'orders', label: 'My Orders' },
                  { id: 'profile', label: 'Profile' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 sm:p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">Order Overview</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recent Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {orders.slice(0, 5).map(order => (
                            <div key={order.order_number} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <div>
                                <p className="font-medium text-sm">#{order.order_number}</p>
                                <p className="text-xs text-gray-500">{order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0} qty</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-sm">KSH {order.total_amount}</p>
                                <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                                  {order.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                          {orders.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No orders yet</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Order Status Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Pending</span>
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                              {stats.pendingOrders}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Active Orders</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {stats.activeOrders}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Total Orders</span>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              {stats.totalOrders}
                            </span>
                          </div>
            </div>
                      </CardContent>
                    </Card>
            </div>
          </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">My Orders</h2>

                  {/* Mobile-friendly orders display */}
                  <div className="block sm:hidden space-y-4">
                    {orders.map(order => (
                      <Card key={order.order_number} className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">#{order.order_number}</p>
                              <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-gray-600">Quantity</p>
                              <p className="font-medium">{order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Total</p>
                              <p className="font-medium">KSH {order.total_amount}</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => viewOrder(order)}
                            className="w-full"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Order Number</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Quantity</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Total</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => (
                          <tr key={order.order_number} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">#{order.order_number}</td>
                            <td className="py-3 px-4">{order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0}</td>
                            <td className="py-3 px-4">KSH {order.total_amount}</td>
                            <td className="py-3 px-4">
                              <Badge className={getStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{new Date(order.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => viewOrder(order)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {orders.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No orders yet</p>
                        <p className="text-sm mt-2">Your orders will appear here once you make a purchase</p>
                      </div>
                    )}
                  </div>
          </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">Account Details</h2>
                  
                  <Card>
                    <CardContent className="p-6">
            {editingProfile ? (
            <div className="space-y-4">
              <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                <input
                  type="email"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  id="email"
                    name="email"
                    value={profileForm.email}
                    onChange={handleProfileChange}
                  />
                </div>
                <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">Name</label>
                  <input
                    type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    id="name"
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileChange}
                />
              </div>
              <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">Phone</label>
                <input
                  type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    id="phone"
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            <Button onClick={handleProfileSave} className="w-full sm:w-auto">Save Changes</Button>
                            <Button variant="outline" onClick={() => setEditingProfile(false)} className="w-full sm:w-auto">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900 break-all">{user.email}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{user.name}</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="text-gray-900">{user.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={() => setEditingProfile(true)} className="w-full sm:w-auto">Edit Profile</Button>
                </div>
              </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Order Details Modal */}
        {showViewOrderModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-primary">Order Details</h2>
                  <button
                    onClick={() => setShowViewOrderModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Close modal"
                    aria-label="Close modal"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Order Header */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                        <p className="text-lg font-semibold text-gray-900">#{selectedOrder.order_number}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                        <p className="text-lg text-gray-900">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
                        <Badge className={selectedOrder.order_type === 'direct' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                          {selectedOrder.order_type}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Order Items</h3>
                    <div className="space-y-4">
                      {selectedOrder.items?.map((item: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                              <p className="text-gray-900">{item.product_name}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                              <p className="text-gray-900">{item.quantity}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                              <p className="text-gray-900">KSH {item.unit_price}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                              <p className="text-lg font-semibold text-green-600">KSH {item.total_amount}</p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                            <p className="text-gray-900">{item.vendor_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-primary">Shipping Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                          <p className="text-gray-900">{selectedOrder.shipping_address}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                          <p className="text-gray-900">{selectedOrder.contact_phone}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-primary">Payment Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                          <Badge className="bg-blue-100 text-blue-800 capitalize">{selectedOrder.payment_method}</Badge>
              </div>
              <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                          <Badge className={selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {selectedOrder.payment_status || 'pending'}
                          </Badge>
              </div>
              <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                          <Badge className={getStatusColor(selectedOrder.status)}>
                            {selectedOrder.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="border-t pt-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-primary">Total Amount</h3>
                      <p className="text-2xl font-bold text-green-600">KSH {selectedOrder.total_amount}</p>
                    </div>
                  </div>

                  {/* Order Notes */}
                  {selectedOrder.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Notes</label>
                      <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">{selectedOrder.notes}</p>
                    </div>
                  )}

                  {/* Update Shipping Address Section - Only for pending orders */}
                  {selectedOrder.status === 'pending' && (
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold text-primary mb-4">Update Shipping Address</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        You can update your shipping address while your order is still pending.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => updateShippingAddress(selectedOrder)}
                        className="w-full sm:w-auto"
                      >
                        Update Shipping Address
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowViewOrderModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update Shipping Address Modal */}
        {showShippingUpdateModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-primary">Update Shipping Address</h2>
                  <button
                    onClick={() => setShowShippingUpdateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Close modal"
                    aria-label="Close modal"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Number
                    </label>
                    <p className="text-gray-900 font-medium">#{selectedOrder.order_number}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="shipping-address">
                      New Shipping Address
                    </label>
                    <textarea
                      id="shipping-address"
                      value={newShippingAddress}
                      onChange={(e) => setNewShippingAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      rows={4}
                      placeholder="Enter your new shipping address..."
                      required
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> You can only update the shipping address for pending orders. 
                      Once your order is confirmed, the address cannot be changed.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowShippingUpdateModal(false)}
                    disabled={updatingShipping}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleShippingUpdate}
                    disabled={updatingShipping || !newShippingAddress.trim()}
                  >
                    {updatingShipping ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Address'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
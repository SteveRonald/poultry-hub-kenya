
import React, { useState, useEffect } from 'react';
import { Users, Package, ShoppingCart, TrendingUp, Check, X, Eye, Edit, Trash2, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import NotificationsMenu from '../components/NotificationsMenu';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState<any>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showViewProductModal, setShowViewProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  useEffect(() => {
    const token = localStorage.getItem('admin_session_token');
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch('http://localhost/poultry-hub-kenya/backend/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('http://localhost/poultry-hub-kenya/backend/api/admin/vendors', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('http://localhost/poultry-hub-kenya/backend/api/admin/products', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('http://localhost/poultry-hub-kenya/backend/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([stats, vendors, products, orders]) => {
      setStats(stats);
      setVendors(Array.isArray(vendors) ? vendors : []);
      setProducts(Array.isArray(products) ? products : []);
      setOrders(Array.isArray(orders) ? orders : []);
      setLoading(false);
    }).catch((error) => {
      toast.error('Failed to load dashboard data');
      setLoading(false);
    });
  }, []);

  const handleApproveVendor = async (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setConfirmDialog({
      show: true,
      title: 'Approve Vendor',
      message: `Are you sure you want to approve vendor "${vendor?.name || vendor?.email}"? This will allow them to start selling products.`,
      type: 'info',
      onConfirm: async () => {
    const token = localStorage.getItem('admin_session_token');
        setActionLoading(`approve-vendor-${vendorId}`);
        try {
          const response = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/vendors/approve', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ vendor_id: vendorId }),
          });
          
          if (response.ok) {
            toast.success('Vendor approved successfully!');
            fetchVendors();
          } else {
            const error = await response.json();
            toast.error(error.error || 'Failed to approve vendor');
          }
        } catch (error) {
          toast.error('Network error. Please try again.');
        } finally {
          setActionLoading(null);
          setConfirmDialog({ ...confirmDialog, show: false });
        }
      }
    });
  };

  const handleRejectVendor = async (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setConfirmDialog({
      show: true,
      title: 'Reject Vendor',
      message: `Are you sure you want to reject vendor "${vendor?.name || vendor?.email}"? This will prevent them from selling products.`,
      type: 'warning',
      onConfirm: async () => {
    const token = localStorage.getItem('admin_session_token');
        setActionLoading(`reject-vendor-${vendorId}`);
        try {
          const response = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/vendors/reject', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ vendor_id: vendorId, reason: 'Application rejected by admin' }),
          });
          
          if (response.ok) {
            toast.success('Vendor rejected successfully!');
            fetchVendors();
          } else {
            const error = await response.json();
            toast.error(error.error || 'Failed to reject vendor');
          }
        } catch (error) {
          toast.error('Network error. Please try again.');
        } finally {
          setActionLoading(null);
          setConfirmDialog({ ...confirmDialog, show: false });
        }
      }
    });
  };

  const handleSuspendVendor = async (vendorId: string) => {
    const token = localStorage.getItem('admin_session_token');
    try {
      const response = await fetch(`http://localhost/poultry-hub-kenya/backend/api/admin/vendors/${vendorId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'suspended' }),
      });
      
      if (response.ok) {
        toast.success('Vendor suspended successfully!');
        fetchVendors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to suspend vendor');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handleDisapproveVendor = async (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setConfirmDialog({
      show: true,
      title: 'Disapprove Vendor',
      message: `Are you sure you want to disapprove vendor "${vendor?.name || vendor?.email}"? This will prevent them from selling products.`,
      type: 'warning',
      onConfirm: async () => {
        const token = localStorage.getItem('admin_session_token');
        setActionLoading(`disapprove-vendor-${vendorId}`);
        try {
          const response = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/vendors/reject', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ vendor_id: vendorId, reason: 'Vendor disapproved by admin' }),
          });
          
          if (response.ok) {
            toast.success('Vendor disapproved successfully!');
            fetchVendors();
          } else {
            const error = await response.json();
            toast.error(error.error || 'Failed to disapprove vendor');
          }
        } catch (error) {
          toast.error('Network error. Please try again.');
        } finally {
          setActionLoading(null);
          setConfirmDialog({ ...confirmDialog, show: false });
        }
      }
    });
  };

  const handleApproveProduct = async (productId: string) => {
    const token = localStorage.getItem('admin_session_token');
    setActionLoading(`approve-product-${productId}`);
    try {
      const response = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/products/approve', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: productId }),
    });
      
      if (response.ok) {
        toast.success('Product approved successfully!');
    fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve product');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectProduct = async (productId: string) => {
    const token = localStorage.getItem('admin_session_token');
    setActionLoading(`reject-product-${productId}`);
    try {
      const response = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/products/reject', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: productId, reason: 'Product rejected by admin' }),
      });
      
      if (response.ok) {
        toast.success('Product rejected successfully!');
        fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reject product');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisapproveProduct = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    setConfirmDialog({
      show: true,
      title: 'Disapprove Product',
      message: `Are you sure you want to disapprove product "${product?.name}"? This will hide it from customers.`,
      type: 'warning',
      onConfirm: async () => {
        const token = localStorage.getItem('admin_session_token');
        setActionLoading(`disapprove-product-${productId}`);
        try {
          const response = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/products/reject', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ product_id: productId, reason: 'Product disapproved by admin' }),
          });
          
          if (response.ok) {
            toast.success('Product disapproved successfully!');
            fetchProducts();
          } else {
            const error = await response.json();
            toast.error(error.error || 'Failed to disapprove product');
          }
        } catch (error) {
          toast.error('Network error. Please try again.');
        } finally {
          setActionLoading(null);
          setConfirmDialog({ ...confirmDialog, show: false });
        }
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const fetchVendors = async () => {
    const token = localStorage.getItem('admin_session_token');
    try {
      const res = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/vendors', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
    const data = await res.json();
    setVendors(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to fetch vendors');
      }
    } catch (error) {
      toast.error('Network error while fetching vendors');
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    const token = localStorage.getItem('admin_session_token');
    try {
      const res = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      toast.error('Network error while fetching users');
    }
  };

  const fetchProducts = async () => {
    const token = localStorage.getItem('admin_session_token');
    try {
      const res = await fetch('http://localhost/poultry-hub-kenya/backend/api/admin/products', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to fetch products');
      }
    } catch (error) {
      toast.error('Network error while fetching products');
    }
  };

  const viewProduct = (product: any) => {
    setSelectedProduct(product);
    setShowViewProductModal(true);
  };

  // Edit user
  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserForm({ ...user });
  };
  const handleUserFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };
  const handleSaveUser = async () => {
    const token = localStorage.getItem('admin_session_token');
    setActionLoading(`save-user-${editingUser.id}`);
    try {
      const response = await fetch(`http://localhost/poultry-hub-kenya/backend/api/admin/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(userForm),
    });
      
      if (response.ok) {
        toast.success('User updated successfully!');
    setEditingUser(null);
    fetchUsers();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update user');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };
  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    setConfirmDialog({
      show: true,
      title: 'Delete User',
      message: `Are you sure you want to delete user "${user?.full_name || user?.email}"? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
    const token = localStorage.getItem('admin_session_token');
        setActionLoading(`delete-user-${userId}`);
        try {
          const response = await fetch(`http://localhost/poultry-hub-kenya/backend/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
          
          if (response.ok) {
            toast.success('User deleted successfully!');
    fetchUsers();
          } else {
            const error = await response.json();
            toast.error(error.error || 'Failed to delete user');
          }
        } catch (error) {
          toast.error('Network error. Please try again.');
        } finally {
          setActionLoading(null);
          setConfirmDialog({ ...confirmDialog, show: false });
        }
      }
    });
  };

  // Fetch all on mount
  useEffect(() => {
    fetchUsers();
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-primary">
                Welcome back, {JSON.parse(localStorage.getItem('admin_info') || '{}').full_name || 'Admin'}! Manage your marketplace.
              </h1>
              <div className="flex items-center space-x-4">
                <div className="bg-white rounded-lg shadow-md px-4 py-2 border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Notifications:</span>
                    <NotificationsMenu isAdmin={true} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <Users className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Vendors</p>
                  <p className="text-xl font-bold text-primary">{stats?.totalVendors || 'Loading...'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="h-6 w-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-xs text-yellow-800 font-bold">{stats?.pendingVendors || '0'}</span>
                  </div>
                  <p className="text-sm text-gray-600">Pending Vendors</p>
                  <p className="text-xl font-bold text-primary">{stats?.pendingVendors || '0'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <Package className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-xl font-bold text-primary">{stats?.totalProducts || 'Loading...'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="h-6 w-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-xs text-yellow-800 font-bold">{stats?.pendingProducts || '0'}</span>
                  </div>
                  <p className="text-sm text-gray-600">Pending Products</p>
                  <p className="text-xl font-bold text-primary">{stats?.pendingProducts || '0'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <ShoppingCart className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-xl font-bold text-primary">{stats?.totalOrders || 'Loading...'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <TrendingUp className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-lg font-bold text-primary">KSH {(stats?.totalRevenue / 1000000).toFixed(1) || '0.0'}M</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-xl font-bold text-primary">{stats?.totalUsers || 'Loading...'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Admins</p>
                  <p className="text-xl font-bold text-primary">{stats?.totalAdmins || 'Loading...'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'vendors', label: 'Vendor Approvals' },
                  { id: 'products', label: 'Product Approvals' },
                  { id: 'orders', label: 'All Orders' },
                  { id: 'users', label: 'User Management' },
                  { id: 'analytics', label: 'Analytics' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                    {(tab.id === 'vendors' && stats?.pendingVendors > 0) && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        {stats?.pendingVendors}
                      </span>
                    )}
                    {(tab.id === 'products' && stats?.pendingProducts > 0) && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        {stats?.pendingProducts}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">Platform Overview</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recent Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Array.isArray(orders) && orders.map(order => (
                            <div key={order.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <div>
                                <p className="font-medium text-sm">{order.customer}</p>
                                <p className="text-xs text-gray-500">{order.product} - {order.vendor}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-sm">KSH {order.amount}</p>
                                <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                                  {order.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Pending Approvals</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Vendor Applications</span>
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                              {stats?.pendingVendors || 0} pending
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Product Listings</span>
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                              {stats?.pendingProducts || 0} pending
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Bell className="h-5 w-5 mr-2 text-primary" />
                          Notifications
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-center">
                            <NotificationsMenu isAdmin={true} />
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">
                              Click the bell icon above to view all notifications
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Vendor Approvals Tab */}
              {activeTab === 'vendors' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">Vendor Approvals</h2>

                  <div className="space-y-4">
                    {Array.isArray(vendors) && vendors.map(vendor => (
                      <Card key={vendor.id}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-primary">{vendor.name}</h3>
                              <p className="text-gray-600 mb-2">{vendor.farmName}</p>
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                <div>
                                  <span className="font-medium">Location:</span> {vendor.location}
                                </div>
                                <div>
                                  <span className="font-medium">Email:</span> {vendor.email}
                                </div>
                                <div>
                                  <span className="font-medium">Phone:</span> {vendor.phone}
                                </div>
                                <div>
                                  <span className="font-medium">Applied:</span> {vendor.registrationDate}
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                              {vendor.status === 'approved' ? (
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleDisapproveVendor(vendor.id)}
                                  disabled={actionLoading === `disapprove-vendor-${vendor.id}`}
                                >
                                  {actionLoading === `disapprove-vendor-${vendor.id}` ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  ) : (
                                    <X className="h-4 w-4 mr-2" />
                                  )}
                                  Disapprove
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleApproveVendor(vendor.id)}
                                  disabled={actionLoading === `approve-vendor-${vendor.id}`}
                                >
                                  {actionLoading === `approve-vendor-${vendor.id}` ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  ) : (
                                    <Check className="h-4 w-4 mr-2" />
                                  )}
                                  Approve
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Approvals Tab */}
              {activeTab === 'products' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">Product Approvals</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Vendor</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Category</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Price</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Submitted</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(products) && products.map(product => (
                          <tr key={product.id} className="border-b border-gray-100">
                            <td className="py-3 px-4 font-medium">{product.name}</td>
                            <td className="py-3 px-4">{product.vendor}</td>
                            <td className="py-3 px-4 capitalize">{product.category}</td>
                            <td className="py-3 px-4">KSH {product.price}</td>
                            <td className="py-3 px-4">{product.submissionDate}</td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => viewProduct(product)}
                                  title="View product details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {product.status === 'approved' ? (
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    onClick={() => handleDisapproveProduct(product.id)}
                                    disabled={actionLoading === `disapprove-product-${product.id}`}
                                  >
                                    {actionLoading === `disapprove-product-${product.id}` ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                      <X className="h-4 w-4" />
                                    )}
                                    Disapprove
                                  </Button>
                                ) : (
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleApproveProduct(product.id)}
                                    disabled={actionLoading === `approve-product-${product.id}`}
                                >
                                    {actionLoading === `approve-product-${product.id}` ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                  <Check className="h-4 w-4" />
                                    )}
                                    Approve
                                </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">All Orders</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Order ID</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Vendor</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(orders) && orders.map(order => (
                          <tr key={order.id} className="border-b border-gray-100">
                            <td className="py-3 px-4">#{order.id}</td>
                            <td className="py-3 px-4">{order.customer}</td>
                            <td className="py-3 px-4">{order.vendor}</td>
                            <td className="py-3 px-4">{order.product}</td>
                            <td className="py-3 px-4">KSH {order.amount}</td>
                            <td className="py-3 px-4">
                              <Badge className={getStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{order.date}</td>
                            <td className="py-3 px-4">
                              <Button size="sm" variant="outline">
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* User Management Tab */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">User Management</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Joined</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(users) && users.map(user => (
                          <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">{user.full_name}</td>
                            <td className="py-3 px-4">{user.email}</td>
                            <td className="py-3 px-4">{user.phone || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <Badge className={user.role === 'admin' ? 'bg-purple-100 text-purple-800' : user.role === 'vendor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                                {user.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{new Date(user.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEditUser(user)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={actionLoading === `delete-user-${user.id}`}
                                >
                                  {actionLoading === `delete-user-${user.id}` ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Edit User Modal */}
                  {editingUser && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Edit User</h3>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input
                              id="full_name"
                              type="text"
                              name="full_name"
                              value={userForm.full_name || ''}
                              onChange={handleUserFormChange}
                              placeholder="Enter full name"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                              id="email"
                              type="email"
                              name="email"
                              value={userForm.email || ''}
                              onChange={handleUserFormChange}
                              placeholder="Enter email address"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input
                              id="phone"
                              type="tel"
                              name="phone"
                              value={userForm.phone || ''}
                              onChange={handleUserFormChange}
                              placeholder="Enter phone number"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                              id="role"
                              name="role"
                              value={userForm.role || ''}
                              onChange={handleUserFormChange}
                              title="Select user role"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="customer">Customer</option>
                              <option value="vendor">Vendor</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                          <Button 
                            variant="outline" 
                            onClick={() => setEditingUser(null)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleSaveUser}
                            disabled={actionLoading === `save-user-${editingUser.id}`}
                          >
                            {actionLoading === `save-user-${editingUser.id}` ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            ) : null}
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-primary">Platform Analytics</h2>
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Advanced analytics dashboard coming soon...</p>
                    <p className="text-sm mt-2">Track platform performance, user engagement, and revenue metrics</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Confirmation Dialog */}
        {confirmDialog.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                  confirmDialog.type === 'danger' ? 'bg-red-100' : 
                  confirmDialog.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  {confirmDialog.type === 'danger' ? (
                    <X className="h-5 w-5 text-red-600" />
                  ) : confirmDialog.type === 'warning' ? (
                    <X className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <Check className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <h3 className="text-lg font-semibold">{confirmDialog.title}</h3>
              </div>
              <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}
                >
                  Cancel
                </Button>
                <Button 
                  className={confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 
                            confirmDialog.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' : 
                            'bg-blue-600 hover:bg-blue-700'}
                  onClick={confirmDialog.onConfirm}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Product Modal */}
      {showViewProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-primary">Product Details</h2>
                <button
                  onClick={() => setShowViewProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Product Images */}
                {selectedProduct.image_urls && JSON.parse(selectedProduct.image_urls).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Product Images</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {JSON.parse(selectedProduct.image_urls).map((url: string, index: number) => (
                        <div key={index} className="relative">
                          <img
                            src={url.replace(/\\/g, '/')}
                            alt={`${selectedProduct.name} ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border"
                            onError={(e) => {
                              console.log('Image failed to load:', url);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedProduct.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                    <p className="text-lg text-gray-900">{selectedProduct.vendorName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <p className="text-lg text-gray-900 capitalize">{selectedProduct.category}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                    <p className="text-lg font-semibold text-green-600">KSH {selectedProduct.price}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                    <p className="text-lg text-gray-900">{selectedProduct.stockQuantity}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <Badge className={selectedProduct.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {selectedProduct.status}
                    </Badge>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Submitted</label>
                    <p className="text-sm text-gray-600">{selectedProduct.submissionDate}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Location</label>
                    <p className="text-sm text-gray-600">{selectedProduct.vendorLocation}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedProduct.description}</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowViewProductModal(false)}
                >
                  Close
                </Button>
                {selectedProduct.status === 'approved' ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setShowViewProductModal(false);
                      handleDisapproveProduct(selectedProduct.id);
                    }}
                  >
                    Disapprove Product
                  </Button>
                ) : (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      setShowViewProductModal(false);
                      handleApproveProduct(selectedProduct.id);
                    }}
                  >
                    Approve Product
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AdminDashboard;

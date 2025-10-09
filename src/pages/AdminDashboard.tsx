
import React, { useState, useEffect } from 'react';
import { Users, Package, ShoppingCart, TrendingUp, Check, X, Eye, Edit, Trash2, Bell, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import NotificationsMenu from '../components/NotificationsMenu';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';
import Analytics from '../components/Analytics';
import { useAdmin } from '../contexts/AdminContext';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { admin } = useAdmin();
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
  const [showViewOrderModal, setShowViewOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');
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
      fetch(getApiUrl('/api/admin/stats'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/admin/vendors'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/admin/products'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/admin/orders'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/contact'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([stats, vendors, products, orders, contactMessages]) => {
      setStats(stats);
      setVendors(Array.isArray(vendors) ? vendors : []);
      setProducts(Array.isArray(products) ? products : []);
      setOrders(Array.isArray(orders) ? orders : []);
      setContactMessages(Array.isArray(contactMessages) ? contactMessages : []);
      setLoading(false);
    }).catch((error) => {
      toast.error('Failed to load dashboard data');
      setLoading(false);
    });
  }, []);

  // Real-time notifications for contact messages
  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem('admin_session_token');
      if (token) {
        fetch(getApiUrl('/api/contact'), { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(messages => {
            const newMessages = Array.isArray(messages) ? messages : [];
            const currentNewCount = contactMessages.filter(msg => msg.status === 'new').length;
            const updatedNewCount = newMessages.filter(msg => msg.status === 'new').length;
            
            // Show notification if new messages arrived
            if (updatedNewCount > currentNewCount) {
              toast.success(`You have ${updatedNewCount - currentNewCount} new contact message(s)!`);
            }
            
            setContactMessages(newMessages);
          })
          .catch(error => {
            if (import.meta.env.DEV) {
              console.error('Failed to fetch contact messages:', error);
            }
          });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [contactMessages]);

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
          const response = await fetch(getApiUrl('/api/admin/vendors/approve'), {
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
          const response = await fetch(getApiUrl('/api/admin/vendors/reject'), {
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
      const response = await fetch(getApiUrl(`/api/admin/vendors/${vendorId}/status`), {
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
          const response = await fetch(getApiUrl('/api/admin/vendors/reject'), {
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
      const response = await fetch(getApiUrl('/api/admin/products/approve'), {
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
      const response = await fetch(getApiUrl('/api/admin/products/reject'), {
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
          const response = await fetch(getApiUrl('/api/admin/products/reject'), {
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
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'processing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'shipped': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const fetchVendors = async () => {
    const token = localStorage.getItem('admin_session_token');
    try {
      const res = await fetch(getApiUrl('/api/admin/vendors'), { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(getApiUrl('/api/admin/users'), { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(getApiUrl('/api/admin/products'), { headers: { Authorization: `Bearer ${token}` } });
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

  const fetchContactMessages = async () => {
    const token = localStorage.getItem('admin_session_token');
    try {
      const res = await fetch(getApiUrl('/api/contact'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContactMessages(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to fetch contact messages');
      }
    } catch (error) {
      toast.error('Failed to fetch contact messages');
    }
  };

  const viewProduct = (product: any) => {
    setSelectedProduct(product);
    setShowViewProductModal(true);
  };

  const viewOrder = (order: any) => {
    setSelectedOrder(order);
    setShowViewOrderModal(true);
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, statusNotes?: string) => {
    const token = localStorage.getItem('admin_session_token');
    setActionLoading(`update-order-${orderId}`);
    try {
      const response = await fetch(getApiUrl(`/api/admin/orders/status?id=${orderId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, status_notes: statusNotes }),
      });
      
      if (response.ok) {
        toast.success('Order status updated successfully!');
        // Refresh orders data
        const res = await fetch(getApiUrl('/api/admin/orders'), { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : []);
        }
        setShowViewOrderModal(false);
        setSelectedOrder(null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update order status');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReplyToMessage = async () => {
    if (!selectedMessage || !replyText.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    setActionLoading('replying');
    const token = localStorage.getItem('admin_session_token');
    
    try {
      const res = await fetch(getApiUrl('/api/contact'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message_id: selectedMessage.id,
          reply: replyText
        })
      });

      if (res.ok) {
        toast.success('Reply sent successfully');
        setShowReplyModal(false);
        setReplyText('');
        setSelectedMessage(null);
        fetchContactMessages(); // Refresh messages
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to send reply');
      }
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setActionLoading(null);
    }
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
      const response = await fetch(getApiUrl(`/api/admin/users/${editingUser.id}`), {
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
          const response = await fetch(getApiUrl(`/api/admin/users/${userId}`), {
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
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
              <h1 className="text-2xl lg:text-3xl font-bold text-primary">
                Welcome back, {admin?.full_name || 'Admin'}! Manage your marketplace.
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
              <nav className="flex flex-wrap space-x-2 sm:space-x-8 px-4 sm:px-6 overflow-x-auto">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'vendors', label: 'Vendor Approvals' },
                  { id: 'products', label: 'Product Approvals' },
                  { id: 'orders', label: 'All Orders' },
                  { id: 'users', label: 'User Management' },
                  { id: 'messages', label: 'Contact Messages' },
                  { id: 'analytics', label: 'Analytics' }
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
                    {(tab.id === 'messages' && contactMessages.filter(msg => msg.status === 'new').length > 0) && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {contactMessages.filter(msg => msg.status === 'new').length}
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
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
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

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Bell className="h-5 w-5 mr-2 text-primary" />
                          Contact Messages
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Total Messages</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {contactMessages.length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">New Messages</span>
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                              {contactMessages.filter(msg => msg.status === 'new').length}
                            </span>
                          </div>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveTab('messages')}
                              className="w-full"
                            >
                              View Messages
                            </Button>
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
                          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-primary">{vendor.name}</h3>
                              <p className="text-gray-600 mb-2">{vendor.farmName}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
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
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 lg:ml-4">
                              <Button size="sm" variant="outline" className="w-full sm:w-auto">
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                              {vendor.status === 'approved' ? (
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleDisapproveVendor(vendor.id)}
                                  disabled={actionLoading === `disapprove-vendor-${vendor.id}`}
                                  className="w-full sm:w-auto"
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
                                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
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
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => viewOrder(order)}
                              >
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

              {/* Contact Messages Tab */}
              {activeTab === 'messages' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-primary">Contact Messages</h2>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {contactMessages.filter(msg => msg.status === 'new').length} new messages
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchContactMessages}
                        disabled={actionLoading === 'fetch-messages'}
                      >
                        {actionLoading === 'fetch-messages' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                        ) : null}
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {contactMessages.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No contact messages yet</p>
                      <p className="text-sm mt-2">Messages from the contact form will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {contactMessages.map((message) => (
                        <Card key={message.id} className={`${message.status === 'new' ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''}`}>
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900">{message.subject}</h3>
                                  <Badge className={message.status === 'new' ? 'bg-blue-100 text-blue-800' : 
                                                   message.status === 'replied' ? 'bg-green-100 text-green-800' : 
                                                   'bg-gray-100 text-gray-800'}>
                                    {message.status}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                                  <div>
                                    <span className="font-medium">From:</span> {message.name} ({message.email})
                                  </div>
                                  <div>
                                    <span className="font-medium">Category:</span> {message.category || 'General'}
                                  </div>
                                  {message.phone && (
                                    <div>
                                      <span className="font-medium">Phone:</span> {message.phone}
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">Date:</span> {new Date(message.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMessage(message);
                                    setShowReplyModal(true);
                                  }}
                                  disabled={message.status === 'replied'}
                                >
                                  {message.status === 'replied' ? 'Replied' : 'Reply'}
                                </Button>
                              </div>
                            </div>
                            
                            <div className="border-t pt-4">
                              <h4 className="font-medium text-gray-900 mb-2">Message:</h4>
                              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                                {message.message}
                              </p>
                            </div>

                            {message.admin_reply && (
                              <div className="border-t pt-4 mt-4">
                                <h4 className="font-medium text-gray-900 mb-2">Admin Reply:</h4>
                                <p className="text-gray-700 whitespace-pre-wrap bg-blue-50 p-3 rounded border-l-4 border-blue-200">
                                  {message.admin_reply}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  Replied on: {new Date(message.updated_at).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <Analytics />
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
                            src={getImageUrl(url.replace(/\\/g, '/'))}
                            alt={`${selectedProduct.name} ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border"
                            onError={(e) => {
                              if (import.meta.env.DEV) {
                                console.log('Image failed to load:', url);
                              }
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

        {/* Reply to Contact Message Modal */}
        {showReplyModal && selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-primary">Reply to Message</h2>
                  <button
                    onClick={() => {
                      setShowReplyModal(false);
                      setSelectedMessage(null);
                      setReplyText('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Close modal"
                    aria-label="Close modal"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Original Message */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Original Message</h3>
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>From:</strong> {selectedMessage.name} ({selectedMessage.email})
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>Subject:</strong> {selectedMessage.subject}
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      <strong>Date:</strong> {new Date(selectedMessage.created_at).toLocaleString()}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>

                  {/* Reply Form */}
                  <div>
                    <label htmlFor="reply-text" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Reply
                    </label>
                    <textarea
                      id="reply-text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply here..."
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      title="Enter your reply message"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowReplyModal(false);
                      setSelectedMessage(null);
                      setReplyText('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReplyToMessage}
                    disabled={actionLoading === 'replying' || !replyText.trim()}
                  >
                    {actionLoading === 'replying' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : null}
                    Send Reply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* View Order Details Modal */}
      {showViewOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
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
                      <p className="text-lg font-semibold text-gray-900">{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                      <p className="text-lg text-gray-900">{new Date(selectedOrder.date).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
                      <Badge className={selectedOrder.order_type === 'direct' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {selectedOrder.order_type}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Product Images */}
                {selectedOrder.product_images && JSON.parse(selectedOrder.product_images).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Product Images</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {JSON.parse(selectedOrder.product_images).map((url: string, index: number) => (
                        <div key={index} className="relative">
                          <img
                            src={url.replace(/\\/g, '/')}
                            alt={`${selectedOrder.product} ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border"
                            onError={(e) => {
                              if (import.meta.env.DEV) {
                                console.log('Image failed to load:', url);
                              }
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Customer Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <p className="text-gray-900">{selectedOrder.customer}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <p className="text-gray-900">{selectedOrder.customer_email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <p className="text-gray-900">{selectedOrder.customer_phone || 'N/A'}</p>
                      </div>
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

                  {/* Vendor Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Vendor Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                        <p className="text-gray-900">{selectedOrder.vendor}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <p className="text-gray-900">{selectedOrder.vendor_email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <p className="text-gray-900">{selectedOrder.vendor_phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <p className="text-gray-900">{selectedOrder.vendor_location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Product Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                      <p className="text-lg font-semibold text-gray-900">{selectedOrder.product}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <p className="text-lg text-gray-900">{selectedOrder.quantity}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                      <p className="text-lg text-gray-900">KSH {selectedOrder.unit_price}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                      <p className="text-lg font-semibold text-green-600">KSH {selectedOrder.amount}</p>
                    </div>
                  </div>
                  {selectedOrder.product_description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedOrder.product_description}</p>
                    </div>
                  )}
                </div>

                {/* Payment & Status Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Order Status</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
                        <Badge className={getStatusColor(selectedOrder.status)}>
                          {selectedOrder.status}
                        </Badge>
                      </div>
                      {selectedOrder.status_notes && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status Notes</label>
                          <p className="text-gray-900">{selectedOrder.status_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Notes */}
                {selectedOrder.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Notes</label>
                    <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Status Update Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">Update Order Status</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
                      <Button
                        key={status}
                        variant={selectedOrder.status === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleUpdateOrderStatus(selectedOrder.id, status)}
                        disabled={actionLoading === `update-order-${selectedOrder.id}`}
                        className="capitalize"
                      >
                        {actionLoading === `update-order-${selectedOrder.id}` ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : null}
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
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

      <Footer />
    </div>
  );
};

export default AdminDashboard;


import React, { useState, useEffect, useRef } from 'react';
import { Users, Package, ShoppingCart, TrendingUp, Check, X, Eye, Edit, Trash2, Bell, BarChart3, DollarSign, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import NotificationsMenu from '../components/NotificationsMenu';
import DashboardSidebar from '../components/DashboardSidebar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';
import Analytics from '../components/Analytics';
import BackupManagement from '../components/BackupManagement';
import AdminAdvertisementManager from '../components/AdminAdvertisementManager';
import { useAdmin } from '../contexts/AdminContext';
import MarketInsightsWidget from '../components/MarketInsightsWidget';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { admin, updateAdmin } = useAdmin();
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
  const [commissionData, setCommissionData] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsStats, setSmsStats] = useState<any>(null);
  const [smsLoading, setSmsLoading] = useState(false);
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
  
  // Profile update states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Delete confirmation states
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [showDeleteOrderModal, setShowDeleteOrderModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  
  // Account status toggle states
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to section when tab changes
  useEffect(() => {
    if (!activeTab) return;
    
    const scrollToSection = () => {
      const element = document.getElementById(`tab-section-${activeTab}`);
      if (!element) {
        if (import.meta.env.DEV) {
          console.log(`Element not found: tab-section-${activeTab}`);
        }
        return;
      }
      
      // Check if mobile (screen width < 1024px)
      const isMobile = window.innerWidth < 1024;
      
      // On mobile, scroll window instead of container for better UX
      if (isMobile) {
        const headerOffset = 100; // Account for navbar/header height
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
        return;
      }
      
      // Use the main content ref for desktop
      const scrollableContainer = mainContentRef.current;
      if (!scrollableContainer) {
        // Fallback: Scroll window
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - 120;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
        return;
      }
      
      const headerOffset = 120; // Account for navbar/header height
      
      // Use getBoundingClientRect for accurate positioning
      const containerRect = scrollableContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Calculate relative position
      const relativeTop = elementRect.top - containerRect.top;
      const currentScrollTop = scrollableContainer.scrollTop;
      
      // Calculate target scroll position
      const targetScrollTop = currentScrollTop + relativeTop - headerOffset;
      
      // Always scroll to bring the element into view (even if it seems visible)
      // This ensures consistent behavior
      scrollableContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    };
    
    // Delay to ensure DOM is updated and content is rendered
    const timer = setTimeout(scrollToSection, 300);
    return () => clearTimeout(timer);
  }, [activeTab]);

  useEffect(() => {
    const token = localStorage.getItem('admin_session_token');
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(getApiUrl('/api/admin/stats'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/admin/vendors'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/admin/products'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/admin/orders') + '?t=' + Date.now(), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/contact'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/admin/commission-data'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
    ]).then(([stats, vendors, products, orders, contactMessages, commissionData]) => {
      setStats(stats);
      setVendors(Array.isArray(vendors) ? vendors : []);
      setProducts(Array.isArray(products) ? products : []);
      setOrders(Array.isArray(orders) ? orders : []);
      setContactMessages(Array.isArray(contactMessages) ? contactMessages : []);
      setCommissionData(commissionData);
      setLoading(false);
    }).catch((error) => {
      toast.error('Failed to load dashboard data');
      setLoading(false);
    });
    
    // Listen for order status updates from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orderStatusUpdate' && e.newValue) {
        try {
          const update = JSON.parse(e.newValue);
          if (update.source === 'vendor') {
            // Refresh orders when vendor makes changes
            const token = localStorage.getItem('admin_session_token');
            if (token) {
              fetch(getApiUrl('/api/admin/orders') + '?t=' + Date.now(), { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(orders => setOrders(Array.isArray(orders) ? orders : []));
              
              fetch(getApiUrl('/api/admin/stats'), { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(stats => setStats(stats));
              
              fetch(getApiUrl('/api/admin/commission-data'), { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(commissionData => setCommissionData(commissionData));
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error parsing order status update:', error);
          }
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Periodic auto-refresh to keep dashboard up to date
  useEffect(() => {
    const token = localStorage.getItem('admin_session_token');
    if (!token) return;
    const refresh = () => {
      Promise.all([
        fetch(getApiUrl('/api/admin/stats'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(getApiUrl('/api/admin/vendors'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(getApiUrl('/api/admin/products'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(getApiUrl('/api/admin/orders') + '?t=' + Date.now(), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(getApiUrl('/api/contact'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(getApiUrl('/api/admin/commission-data'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
      ]).then(([stats, vendors, products, orders, contactMessages, commissionData]) => {
        setStats(stats);
        setVendors(Array.isArray(vendors) ? vendors : []);
        setProducts(Array.isArray(products) ? products : []);
        setOrders(Array.isArray(orders) ? orders : []);
        setContactMessages(Array.isArray(contactMessages) ? contactMessages : []);
        setCommissionData(commissionData);
      }).catch(() => {
        // ignore periodic errors; next cycle will try again
      });
    };
    const intervalId = window.setInterval(refresh, 60000); // 60s
    return () => window.clearInterval(intervalId);
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
    
    // Optimistically update the UI immediately
    const updatedOrders = orders.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus, status_notes: statusNotes, updated_at: new Date().toISOString() }
        : order
    );
    setOrders(updatedOrders);
    
    // Update selected order in modal if it's the same order
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus, status_notes: statusNotes });
    }
    
    try {
      const response = await fetch(getApiUrl(`/api/admin/orders/status?id=${orderId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, status_notes: statusNotes }),
      });
      
      // Check if response is OK before parsing JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails but status is OK, assume success
        if (response.ok) {
          data = { success: true, message: 'Order status updated successfully' };
        } else {
          data = { error: 'Failed to parse response' };
        }
      }
      
      if (response.ok && data.success !== false) {
        toast.success('Order status updated successfully!');
        
        // Refresh orders after status update
        const token = localStorage.getItem('admin_session_token');
        if (token) {
          // Small delay to ensure database transaction is committed
          await new Promise(resolve => setTimeout(resolve, 200));
          
          fetch(getApiUrl('/api/admin/orders') + '?t=' + Date.now(), {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(r => r.json())
            .then(ordersData => {
              if (ordersData.success && Array.isArray(ordersData.orders)) {
                setOrders(ordersData.orders);
              } else if (Array.isArray(ordersData)) {
                setOrders(ordersData);
              }
            })
            .catch(() => {
              // Silently fail - orders were already optimistically updated
            });
        }
        if (newStatus === 'delivered') {
          const statsRes = await fetch(getApiUrl('/api/admin/stats'), { headers: { Authorization: `Bearer ${token}` } });
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats(statsData);
          }
        }
        
        // Notify other tabs about the status change
        localStorage.setItem('orderStatusUpdate', JSON.stringify({
          orderId,
          newStatus,
          timestamp: Date.now(),
          source: 'admin'
        }));
        
        setShowViewOrderModal(false);
        setSelectedOrder(null);
      } else {
        // Revert optimistic update on failure
        const res = await fetch(getApiUrl('/api/admin/orders') + '?t=' + Date.now(), { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const ordersData = await res.json();
          if (ordersData.success && Array.isArray(ordersData.orders)) {
            setOrders(ordersData.orders);
          } else if (Array.isArray(ordersData)) {
            setOrders(ordersData);
          }
        }
        
        toast.error(data.error || 'Failed to update order status');
      }
    } catch (error) {
      // Try to verify if the update actually succeeded by fetching orders
      try {
        const res = await fetch(getApiUrl('/api/admin/orders') + '?t=' + Date.now(), { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const ordersData = await res.json();
          const fetchedOrders = (ordersData.success && Array.isArray(ordersData.orders)) 
            ? ordersData.orders 
            : (Array.isArray(ordersData) ? ordersData : []);
          
          setOrders(fetchedOrders);
          
          // Check if the order was actually updated by comparing with fetched orders
          const updatedOrder = fetchedOrders.find((o: any) => o.id === orderId);
          if (updatedOrder && updatedOrder.status === newStatus) {
            // Order was updated successfully, just JSON parsing failed
            toast.success('Order status updated successfully!');
            setShowViewOrderModal(false);
            setSelectedOrder(null);
            return; // Exit early since update succeeded
          }
        }
      } catch (fetchError) {
        // If we can't verify, show error
      }
      
      // If we get here, the update likely failed
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

  // Fetch admin profile data
  const fetchAdminProfile = async () => {
    const token = localStorage.getItem('admin_session_token');
    if (!token) return;
    
    try {
      const response = await fetch(getApiUrl('/api/admin/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const adminData = await response.json();
        updateAdmin(adminData);
      }
    } catch (error) {
      console.error('Error fetching admin profile:', error);
    }
  };

  // Profile update functions
  const openEditProfileModal = () => {
    if (admin) {
      setProfileFormData({
        full_name: admin.full_name || '',
        email: admin.email || '',
        phone: admin.phone || ''
      });
    }
    setShowEditProfileModal(true);
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSubmitting(true);
    
    try {
      const token = localStorage.getItem('admin_session_token');
      
      const response = await fetch(getApiUrl('/api/admin/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileFormData)
      });

      if (response.ok) {
        // Refresh admin data
        const adminResponse = await fetch(getApiUrl('/api/admin/me'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          // Update admin context
          updateAdmin(adminData);
        }
        
        setShowEditProfileModal(false);
        toast.success('Your profile has been updated successfully!');
      } else {
        const responseText = await response.text();
        console.error('Profile update error response:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || 'Failed to update profile');
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile. Please try again.");
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Delete contact message function
  const handleDeleteContactMessage = async () => {
    if (!contactToDelete) return;
    
    setDeleting(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/admin/contact-messages/delete'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: contactToDelete.id })
      });

      if (response.ok) {
        // Remove from local state
        setContactMessages(prev => prev.filter(msg => msg.id !== contactToDelete.id));
        setShowDeleteContactModal(false);
        setContactToDelete(null);
        toast.success('Contact message deleted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete contact message');
      }
    } catch (error) {
      console.error('Error deleting contact message:', error);
      toast.error(error instanceof Error ? error.message : "Failed to delete contact message. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // Delete order function
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    setDeleting(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/admin/orders/delete'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: orderToDelete.id })
      });

      if (response.ok) {
        // Remove from local state
        setOrders(prev => prev.filter(order => order.id !== orderToDelete.id));
        setShowDeleteOrderModal(false);
        setOrderToDelete(null);
        setDeleteConfirmationText('');
        toast.success('Order deleted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete order');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(error instanceof Error ? error.message : "Failed to delete order. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // Toggle user account status function
  const handleToggleAccountStatus = async (userId: string, currentStatus: string) => {
    setTogglingStatus(userId);
    try {
      const token = localStorage.getItem('admin_session_token');
      const action = currentStatus === 'active' ? 'disable' : 'enable';
      
      const response = await fetch(getApiUrl('/api/admin/users/toggle-status'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId, action })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update the user in the local state
        setUsers(prev => prev.map(user => 
          user.id === userId 
            ? { ...user, account_status: result.new_status }
            : user
        ));
        
        toast.success(result.message);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account status');
      }
    } catch (error) {
      console.error('Error toggling account status:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update account status. Please try again.");
    } finally {
      setTogglingStatus(null);
    }
  };

  // Fetch all on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch admin profile data when profile tab is accessed
  useEffect(() => {
    if (activeTab === 'profile') {
      fetchAdminProfile();
    }
    
    if (activeTab === 'sms') {
      fetchSMSLogs();
    }
  }, [activeTab]);
  
  const fetchSMSLogs = async () => {
    const token = localStorage.getItem('admin_session_token');
    if (!token) {
      if (import.meta.env.DEV) {
        console.error('No admin token found');
      }
      return;
    }
    
    setSmsLoading(true);
    try {
      const apiUrl = getApiUrl('/api/admin/sms/logs');
      console.log('🔍 Fetching SMS logs from:', apiUrl);
      console.log('🔑 Using token:', token.substring(0, 20) + '...');
      
      const [logsRes, statsRes] = await Promise.all([
        fetch(apiUrl, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(getApiUrl('/api/admin/sms/stats'), {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      console.log('📡 SMS Logs Response Status:', logsRes.status, logsRes.statusText);
      console.log('📋 SMS Logs Response Headers:', Object.fromEntries(logsRes.headers.entries()));
      
      if (logsRes.ok) {
        let logsData;
        try {
          logsData = await logsRes.json();
        } catch (jsonError) {
          if (import.meta.env.DEV) {
            console.error('Failed to parse SMS logs JSON:', jsonError);
          }
          setSmsLogs([]);
          return;
        }
        
        // Always log in console (not just dev mode) for debugging
        console.log('📦 SMS Logs Response:', logsData);
        console.log('📊 logsData type:', typeof logsData);
        console.log('📊 logsData.logs type:', typeof logsData?.logs);
        console.log('📊 logsData.logs is array:', Array.isArray(logsData?.logs));
        console.log('📊 logsData.logs value:', logsData?.logs);
        
        // Handle different response formats
        let logs: any[] = [];
        
        // Check if response itself is an array
        if (Array.isArray(logsData)) {
          logs = logsData;
        }
        // Check if response has success and logs property
        else if (logsData && logsData.success !== false) {
          if (Array.isArray(logsData.logs)) {
            logs = logsData.logs;
          } else if (logsData.logs && typeof logsData.logs === 'object' && !Array.isArray(logsData.logs)) {
            // If it's an object (not array), try to convert to array
            logs = Object.values(logsData.logs) as any[];
          } else if (logsData.data && Array.isArray(logsData.data)) {
            // Alternative response format
            logs = logsData.data;
          } else {
            // Log what we got if logs property exists but isn't an array
            if (import.meta.env.DEV) {
              console.warn('logsData.logs exists but is not an array:', typeof logsData.logs, logsData.logs);
            }
          }
        } else {
          // Response doesn't have success or success is false
          if (import.meta.env.DEV) {
            console.warn('Response does not have success=true:', logsData);
            console.log('Full response:', JSON.stringify(logsData, null, 2));
          }
        }
        
        // Always log in console for debugging
        console.log('=== 📋 SMS Logs Parsing Summary ===');
        console.log('Final logs array:', logs);
        console.log('Logs count:', logs.length);
        console.log('Logs is array:', Array.isArray(logs));
        console.log('Original response:', logsData);
        if (logs.length === 0) {
          console.warn('⚠️ WARNING: Logs array is empty!');
          console.log('Full response structure:', JSON.stringify(logsData, null, 2));
          console.log('Response keys:', Object.keys(logsData || {}));
          if (logsData && 'logs' in logsData) {
            console.log('logsData.logs value:', logsData.logs);
            console.log('logsData.logs type:', typeof logsData.logs);
            console.log('logsData.logs is array:', Array.isArray(logsData.logs));
            if (logsData.logs && typeof logsData.logs === 'object') {
              console.log('logsData.logs keys:', Object.keys(logsData.logs));
            }
          }
        } else {
          console.log('✅ SUCCESS: Found', logs.length, 'logs');
          console.log('First log:', logs[0]);
        }
        
        // Ensure we always set an array
        if (Array.isArray(logs)) {
          setSmsLogs(logs);
          if (import.meta.env.DEV && logs.length > 0) {
            console.log('✅ Set smsLogs state with', logs.length, 'items');
          }
        } else {
          console.error('❌ ERROR: logs is not an array:', typeof logs, logs);
          setSmsLogs([]);
        }
      } else {
        const errorText = await logsRes.text();
        if (import.meta.env.DEV) {
          console.error('SMS Logs API failed:', logsRes.status, errorText);
        }
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (import.meta.env.DEV) {
          console.log('SMS Stats Response:', statsData);
        }
        if (statsData.success) {
          setSmsStats(statsData.statistics || {});
        }
      } else {
        const errorText = await statsRes.text();
        if (import.meta.env.DEV) {
          console.error('SMS Stats API failed:', statsRes.status, errorText);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch SMS logs:', error);
      }
    } finally {
      setSmsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          type="admin"
          stats={{
            pendingVendors: stats?.pendingVendors || 0,
            pendingProducts: stats?.pendingProducts || 0,
            newMessages: contactMessages.filter(msg => msg.status === 'new').length || 0
          }}
          isMobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 w-full lg:ml-64">
          <div ref={mainContentRef} className="py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8 w-full max-w-full min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] md:min-h-[calc(100vh-6rem)] pb-8 sm:pb-12 overflow-y-auto">
            {/* Mobile Header with Menu Button */}
            <div className="lg:hidden mb-6 flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex items-center space-x-2">
                <NotificationsMenu isAdmin={true} />
              </div>
            </div>

            {/* Header */}
            <div className="mb-6 sm:mb-8 px-2 sm:px-0">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">Admin Dashboard</h1>
                  <p className="text-gray-600 mt-2 text-sm sm:text-base">Welcome back, {admin?.full_name || 'Admin'}! Manage your marketplace.</p>
                </div>
                <div className="hidden lg:flex items-center space-x-2 sm:space-x-4">
                  <div className="bg-white rounded-lg shadow-md px-3 sm:px-4 py-2 border border-gray-200">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-xs sm:text-sm text-gray-600">Notifications:</span>
                      <NotificationsMenu isAdmin={true} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-accent mx-auto mb-1" />
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Total Vendors</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{stats?.totalVendors || '0'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-1">
                    <span className="text-[10px] text-yellow-800 font-bold">{stats?.pendingVendors || '0'}</span>
                  </div>
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Pending Vendors</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{stats?.pendingVendors || '0'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-accent mx-auto mb-1" />
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Total Products</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{stats ? (stats.totalProducts ?? 0) : 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-1">
                    <span className="text-[10px] text-yellow-800 font-bold">{stats?.pendingProducts || '0'}</span>
                  </div>
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Pending Products</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{stats?.pendingProducts || '0'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-accent mx-auto mb-1" />
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Total Orders</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{stats ? (stats.totalOrders ?? 0) : 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-accent mx-auto mb-1" />
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Platform Revenue</p>
                  <p className="text-xs sm:text-sm md:text-base font-bold text-primary truncate" title={`KSH ${stats?.totalRevenue?.toFixed(2) || '0.00'}`}>KSH {stats?.totalRevenue?.toFixed(2) || '0.00'}</p>
                  <p className="text-[8px] min-[375px]:text-[10px] text-gray-500 mt-1 hidden lg:block">
                    {stats?.commissionRevenue || stats?.advertisementRevenue ? (
                      <>
                        Commission: KSH {stats?.commissionRevenue?.toFixed(2) || '0.00'} | 
                        Ads: KSH {stats?.advertisementRevenue?.toFixed(2) || '0.00'}
                      </>
                    ) : (
                      '10% commission + ad revenue'
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Total Users</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{stats?.totalUsers || 'Loading...'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2 sm:p-3 md:p-4">
                <div className="text-center">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-[10px] min-[375px]:text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 min-h-[2rem] flex items-center justify-center">Total Admins</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{stats?.totalAdmins || 'Loading...'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-4 sm:p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div id="tab-section-overview" className="space-y-6 scroll-mt-24">
                  <h2 className="text-xl font-semibold text-primary">Platform Overview</h2>
                  
                  {/* Market Insights Widget */}
                  <div className="mb-6">
                    <MarketInsightsWidget limit={4} showViewAll={true} />
                  </div>
                  
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
                <div id="tab-section-vendors" className="space-y-6 scroll-mt-24">
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
                <div id="tab-section-products" className="space-y-6 scroll-mt-24">
                  <h2 className="text-xl font-semibold text-primary">Product Approvals</h2>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Product</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Vendor</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Category</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Price</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Submitted</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Array.isArray(products) && products.map(product => (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 max-w-[150px] sm:max-w-none truncate" title={product.name}>
                                    {product.name}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 max-w-[120px] sm:max-w-none truncate" title={product.vendor}>
                                    {product.vendor}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900 capitalize hidden md:table-cell">{product.category}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">KSH {product.price}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">{product.submissionDate}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium">
                                  <div className="flex flex-wrap sm:flex-nowrap gap-1 sm:gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => viewProduct(product)}
                                      title="View product details"
                                      className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                                    >
                                      <Eye className="h-4 w-4" />
                                      <span className="hidden sm:inline ml-1">View</span>
                                    </Button>
                                    {product.status === 'approved' ? (
                                      <Button 
                                        size="sm" 
                                        variant="destructive"
                                        onClick={() => handleDisapproveProduct(product.id)}
                                        disabled={actionLoading === `disapprove-product-${product.id}`}
                                        className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                                      >
                                        {actionLoading === `disapprove-product-${product.id}` ? (
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        ) : (
                                          <>
                                            <X className="h-4 w-4" />
                                            <span className="hidden sm:inline ml-1">Disapprove</span>
                                          </>
                                        )}
                                      </Button>
                                    ) : (
                                      <Button 
                                        size="sm" 
                                        className="bg-green-600 hover:bg-green-700 text-white h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                                        onClick={() => handleApproveProduct(product.id)}
                                        disabled={actionLoading === `approve-product-${product.id}`}
                                      >
                                        {actionLoading === `approve-product-${product.id}` ? (
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        ) : (
                                          <>
                                            <Check className="h-4 w-4" />
                                            <span className="hidden sm:inline ml-1">Approve</span>
                                          </>
                                        )}
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
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'advertisements' && (
                <div id="tab-section-advertisements" className="space-y-6 scroll-mt-24">
                  <AdminAdvertisementManager />
                </div>
              )}

              {activeTab === 'orders' && (
                <div id="tab-section-orders" className="space-y-6 scroll-mt-24">
                  <h2 className="text-xl font-semibold text-primary">All Orders</h2>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Order ID</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Customer</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Vendor</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Product</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Amount</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Order Date</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Last Updated</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Array.isArray(orders) && orders.map(order => (
                              <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">#{order.id}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 max-w-[120px] sm:max-w-none truncate" title={order.customer}>
                                    {order.customer}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                                  <div className="max-w-[120px] truncate" title={order.vendor}>
                                    {order.vendor}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 max-w-[150px] sm:max-w-none truncate" title={order.product}>
                                    {order.product}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">KSH {order.amount}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                                    {order.status}
                                  </Badge>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">{order.date}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                                  {order.last_status_updated ? new Date(order.last_status_updated).toLocaleString() : order.date}
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium">
                                  <div className="flex flex-wrap sm:flex-nowrap gap-1 sm:gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => viewOrder(order)}
                                      className="text-xs sm:text-sm"
                                    >
                                      View Details
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setOrderToDelete(order);
                                        setShowDeleteOrderModal(true);
                                      }}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User Management Tab */}
              {activeTab === 'users' && (
                <div id="tab-section-users" className="space-y-6 scroll-mt-24">
                  <h2 className="text-xl font-semibold text-primary">User Management</h2>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Name</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Email</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Phone</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Role</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Joined</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Array.isArray(users) && users.map(user => (
                              <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 max-w-[150px] sm:max-w-none truncate" title={user.full_name}>
                                    {user.full_name}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 max-w-[180px] sm:max-w-none truncate" title={user.email}>
                                    {user.email}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">{user.phone || 'N/A'}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <Badge className={`text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : user.role === 'vendor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                    {user.role}
                                  </Badge>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <Badge className={`text-xs ${(user.account_status || 'active') === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {user.account_status || 'active'}
                                  </Badge>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium">
                                  <div className="flex flex-wrap sm:flex-nowrap gap-1 sm:gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleEditUser(user)}
                                      className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                                      title="Edit user"
                                    >
                                      <Edit className="h-4 w-4" />
                                      <span className="hidden sm:inline ml-1">Edit</span>
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant={(user.account_status || 'active') === 'active' ? 'destructive' : 'default'}
                                      onClick={() => handleToggleAccountStatus(user.id, user.account_status || 'active')}
                                      disabled={togglingStatus === user.id || user.id === admin?.id}
                                      className={`h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 ${(user.account_status || 'active') === 'disabled' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                                      title={user.account_status === 'active' ? 'Disable user' : 'Enable user'}
                                    >
                                      {togglingStatus === user.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      ) : (user.account_status || 'active') === 'active' ? (
                                        <>
                                          <X className="h-4 w-4" />
                                          <span className="hidden sm:inline ml-1">Disable</span>
                                        </>
                                      ) : (
                                        <>
                                          <Check className="h-4 w-4" />
                                          <span className="hidden sm:inline ml-1">Enable</span>
                                        </>
                                      )}
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => handleDeleteUser(user.id)}
                                      disabled={actionLoading === `delete-user-${user.id}`}
                                      className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                                      title="Delete user"
                                    >
                                      {actionLoading === `delete-user-${user.id}` ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      ) : (
                                        <>
                                          <Trash2 className="h-4 w-4" />
                                          <span className="hidden sm:inline ml-1">Delete</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                      </div>
                    </div>
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
                <div id="tab-section-messages" className="space-y-6 scroll-mt-24">
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
                            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-4 gap-4">
                              <div className="flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900 break-words">{message.subject}</h3>
                                  <Badge className={`${message.status === 'new' ? 'bg-blue-100 text-blue-800' : 
                                                   message.status === 'replied' ? 'bg-green-100 text-green-800' : 
                                                   'bg-gray-100 text-gray-800'} self-start`}>
                                    {message.status}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 mb-3">
                                  <div className="break-words">
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
                              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 lg:ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMessage(message);
                                    setShowReplyModal(true);
                                  }}
                                  disabled={message.status === 'replied'}
                                  className="w-full sm:w-auto"
                                >
                                  {message.status === 'replied' ? 'Replied' : 'Reply'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setContactToDelete(message);
                                    setShowDeleteContactModal(true);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
                                >
                                  Delete
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

              {/* Commission Tab */}
              {activeTab === 'commission' && (
                <div id="tab-section-commission" className="space-y-6 scroll-mt-24">
                  <h2 className="text-xl font-semibold text-primary">Commission Management</h2>
                  
                  {commissionData ? (
                    <>
                      {/* Revenue Overview Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                          <CardContent className="p-6">
                            <div className="text-center">
                              <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                              <h3 className="text-lg font-semibold text-green-900 mb-2">Platform Commission (10%)</h3>
                              <p className="text-3xl font-bold text-green-600">KSH {commissionData.platform_commission?.toFixed(2) || '0.00'}</p>
                              <p className="text-sm text-green-700 mt-1">Total commission earned</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-6">
                            <div className="text-center">
                              <DollarSign className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                              <h3 className="text-lg font-semibold text-purple-900 mb-2">Advertisement Revenue</h3>
                              <p className="text-3xl font-bold text-purple-600">KSH {stats?.advertisementRevenue?.toFixed(2) || '0.00'}</p>
                              <p className="text-sm text-purple-700 mt-1">Total paid by vendors for ads</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-6">
                            <div className="text-center">
                              <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                              <h3 className="text-lg font-semibold text-blue-900 mb-2">Total Platform Revenue</h3>
                              <p className="text-3xl font-bold text-blue-600">KSH {stats?.totalRevenue?.toFixed(2) || '0.00'}</p>
                              <p className="text-sm text-blue-700 mt-1">Commission + Ad Revenue</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Vendor Earnings Card */}
                      <Card>
                        <CardContent className="p-6">
                          <div className="text-center">
                            <Users className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-orange-900 mb-2">Vendor Earnings (90%)</h3>
                            <p className="text-3xl font-bold text-orange-600">KSH {commissionData.vendor_earnings_total?.toFixed(2) || '0.00'}</p>
                            <p className="text-sm text-orange-700 mt-1">Total paid to vendors</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* How Commission Works */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-primary">How Platform Commission Works</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="space-y-2 text-sm text-blue-800">
                              <p>• <strong>Commission Threshold:</strong> KSh 10,000 lifetime sales per vendor</p>
                              <p>• <strong>Before Threshold:</strong> No commission - vendor keeps 100% of sales</p>
                              <p>• <strong>After Threshold:</strong> 10% platform commission, 90% vendor earnings</p>
                              <p>• <strong>Processing:</strong> Commission is calculated automatically when order status changes to "delivered"</p>
                              <p>• <strong>Commission Revenue:</strong> Accumulated 10% commission from orders after threshold</p>
                              <p>• <strong>Advertisement Revenue:</strong> Total revenue from paid advertisements (Basic: KSh 128/day, Premium: KSh 300/day)</p>
                              <p>• <strong>Total Platform Revenue:</strong> Commission Revenue + Advertisement Revenue</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Recent Commission Breakdown */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-primary">Recent Commission Calculations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {commissionData.commission_breakdown?.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">Order Date</th>
                                    <th className="text-left py-2">Product</th>
                                    <th className="text-left py-2">Vendor</th>
                                    <th className="text-left py-2">Order Total</th>
                                    <th className="text-left py-2">Commission (10%)</th>
                                    <th className="text-left py-2">Vendor Earnings (90%)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {commissionData.commission_breakdown.map((commission: any, index: number) => (
                                    <tr key={index} className="border-b">
                                      <td className="py-2 text-sm">
                                        {new Date(commission.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="py-2 text-sm">{commission.product_name}</td>
                                      <td className="py-2 text-sm">{commission.vendor_name || 'N/A'}</td>
                                      <td className="py-2 text-sm font-medium">
                                        KSH {parseFloat(commission.total_amount).toFixed(2)}
                                      </td>
                                      <td className="py-2 text-sm text-green-600 font-medium">
                                        KSH {parseFloat(commission.commission_amount).toFixed(2)}
                                      </td>
                                      <td className="py-2 text-sm text-orange-600 font-medium">
                                        KSH {parseFloat(commission.vendor_amount).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <p>No commission data available yet.</p>
                              <p className="text-sm mt-1">Commission records will appear here once orders are marked as delivered.</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Vendor Earnings Summary */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-primary">Vendor Earnings Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {commissionData.vendor_earnings?.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">Vendor</th>
                                    <th className="text-left py-2">Orders</th>
                                    <th className="text-left py-2">Total Earnings</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {commissionData.vendor_earnings.map((vendor: any, index: number) => (
                                    <tr key={index} className="border-b">
                                      <td className="py-2 text-sm font-medium">{vendor.vendor_name || 'Unknown Vendor'}</td>
                                      <td className="py-2 text-sm">{vendor.order_count}</td>
                                      <td className="py-2 text-sm text-orange-600 font-medium">
                                        KSH {parseFloat(vendor.total_earnings).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <p>No vendor earnings data available yet.</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-gray-500">Loading commission data...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div id="tab-section-analytics" className="scroll-mt-24">
                  <Analytics />
                </div>
              )}

              {/* Backup Tab */}
              {activeTab === 'backup' && (
                <div id="tab-section-backup" className="scroll-mt-24">
                  <BackupManagement />
                </div>
              )}

              {/* SMS Logs Tab */}
              {activeTab === 'sms' && (
                <div id="tab-section-sms" className="space-y-6 scroll-mt-24">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-primary">SMS Logs</h2>
                    <Button
                      onClick={() => {
                        setSmsLoading(true);
                        fetchSMSLogs();
                      }}
                      disabled={smsLoading}
                    >
                      {smsLoading ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>

                  {/* SMS Statistics */}
                  {smsStats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Total SMS</p>
                            <p className="text-2xl font-bold">{smsStats.total || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Sent</p>
                            <p className="text-2xl font-bold text-green-600">{smsStats.sent || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Failed</p>
                            <p className="text-2xl font-bold text-red-600">{smsStats.failed || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">To Customers</p>
                            <p className="text-2xl font-bold text-blue-600">{smsStats.to_customers || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* SMS Logs Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>SMS History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {smsLoading ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">Loading SMS logs...</p>
                        </div>
                      ) : !Array.isArray(smsLogs) ? (
                        <div className="text-center py-8">
                          <p className="text-red-500 font-semibold">Error: Invalid data format received</p>
                          {import.meta.env.DEV && (
                            <div className="text-xs text-gray-400 mt-2 space-y-1">
                              <p>Type: {typeof smsLogs}</p>
                              <p>Is Array: {Array.isArray(smsLogs) ? 'Yes' : 'No'}</p>
                              <p>Value: {JSON.stringify(smsLogs).substring(0, 200)}</p>
                              <p>Has logs property: {smsLogs && 'logs' in smsLogs ? 'Yes' : 'No'}</p>
                              {smsLogs && 'logs' in smsLogs && (
                                <p>logs type: {typeof (smsLogs as any).logs}, is array: {Array.isArray((smsLogs as any).logs) ? 'Yes' : 'No'}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : smsLogs.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No SMS logs found</p>
                          {import.meta.env.DEV && (
                            <p className="text-xs text-gray-400 mt-2">
                              Array is empty (length: {smsLogs.length})
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-4">Phone</th>
                                <th className="text-left py-2 px-4">Message</th>
                                <th className="text-left py-2 px-4">Recipient</th>
                                <th className="text-left py-2 px-4">Status</th>
                                <th className="text-left py-2 px-4">Order ID</th>
                                <th className="text-left py-2 px-4">Sent At</th>
                                <th className="text-left py-2 px-4">Created</th>
                              </tr>
                            </thead>
                            <tbody>
                              {smsLogs.map((log: any) => (
                                <tr key={log.id} className="border-b">
                                  <td className="py-2 px-4">{log.phone}</td>
                                  <td className="py-2 px-4 max-w-xs truncate" title={log.message}>
                                    {log.message}
                                  </td>
                                  <td className="py-2 px-4">
                                    <Badge className={
                                      log.recipient_type === 'customer' ? 'bg-blue-100 text-blue-800' :
                                      log.recipient_type === 'vendor' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'
                                    }>
                                      {log.recipient_type}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-4">
                                    <Badge className={
                                      log.status === 'sent' ? 'bg-green-100 text-green-800' :
                                      log.status === 'failed' ? 'bg-red-100 text-red-800' :
                                      log.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }>
                                      {log.status}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-4">
                                    {log.related_order_id ? `#${log.related_order_id}` : '-'}
                                  </td>
                                  <td className="py-2 px-4">
                                    {log.sent_at ? new Date(log.sent_at).toLocaleString() : '-'}
                                  </td>
                                  <td className="py-2 px-4">
                                    {new Date(log.created_at).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div id="tab-section-profile" className="space-y-6 scroll-mt-24">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-primary">Admin Profile</h2>
                    <Button onClick={openEditProfileModal} className="btn-primary">
                      Edit Profile
                    </Button>
                  </div>

                  {/* Profile Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-primary">Profile Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                          <p className="text-gray-900">{admin?.full_name || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <p className="text-gray-900">{admin?.email || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <p className="text-gray-900">{admin?.phone || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                          <Badge className="bg-green-100 text-green-800">Administrator</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-primary">Account Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
                          <p className="text-gray-900">{admin?.last_login ? new Date(admin.last_login).toLocaleString() : 'Not available'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Created</label>
                          <p className="text-gray-900">{admin?.created_at ? new Date(admin.created_at).toLocaleDateString() : 'Not available'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Admin ID</label>
                          <p className="text-gray-900 font-mono text-sm">{admin?.id || 'Not available'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
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

      {/* Profile Edit Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-primary mb-4">Edit Profile</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={profileFormData.full_name}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={profileFormData.email}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={profileFormData.phone}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditProfileModal(false)}
                    disabled={profileSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="btn-primary"
                    disabled={profileSubmitting}
                  >
                    {profileSubmitting ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </div>
                    ) : (
                      'Update Profile'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Contact Message Confirmation Modal */}
      {showDeleteContactModal && contactToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md mx-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Contact Message</h3>
                <p className="text-sm text-gray-500 mb-6 break-words">
                  Are you sure you want to delete this contact message from <strong>{contactToDelete.name}</strong>? 
                  This action cannot be undone.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteContactModal(false);
                      setContactToDelete(null);
                    }}
                    disabled={deleting}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteContactMessage}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto order-1 sm:order-2"
                  >
                    {deleting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Deleting...
                      </div>
                    ) : (
                      'Delete Message'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {showDeleteOrderModal && orderToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Order</h3>
                <p className="text-sm text-gray-500 mb-4 break-words">
                  <strong>WARNING:</strong> You are about to permanently delete order #{orderToDelete.id} from <strong>{orderToDelete.customer}</strong>.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-6">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ This action is irreversible and will delete:
                  </p>
                  <ul className="text-sm text-red-700 mt-2 text-left">
                    <li>• Order details and history</li>
                    <li>• Order payment information</li>
                    <li>• Commission records (if any)</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  Please type <strong>DELETE</strong> to confirm this action.
                </p>
                <input
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={deleteConfirmationText}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                />
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteOrderModal(false);
                      setOrderToDelete(null);
                      setDeleteConfirmationText('');
                    }}
                    disabled={deleting}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteOrder}
                    disabled={deleting || deleteConfirmationText !== 'DELETE'}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400 w-full sm:w-auto order-1 sm:order-2"
                  >
                    {deleting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Deleting...
                      </div>
                    ) : (
                      'Delete Order Permanently'
                    )}
                  </Button>
                </div>
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

export default AdminDashboard;

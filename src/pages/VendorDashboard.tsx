
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Package, BarChart3, Users, Eye, Edit, Trash2, X, Bell, Sparkles, Loader2, AlertTriangle, DollarSign, Menu, ShieldCheck, Share2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import NotificationsMenu from '../components/NotificationsMenu';
import DashboardSidebar from '../components/DashboardSidebar';
import { LocationSelect } from '../components/LocationSelect';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getApiUrl, getImageUrl } from '../config/api';
import VendorAnalytics from '../components/VendorAnalytics';
import AIProductAssistant from '../components/AIProductAssistant';
import AdvertisementManager from '../components/AdvertisementManager';
import CreateAdvertisementForm from '../components/CreateAdvertisementForm';
import { toast } from 'sonner';
import VendorInbox from './VendorInbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

const VendorDashboard = () => {
  const { user, fetchUser, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [advertisements, setAdvertisements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productForm, setProductForm] = useState<any>({ 
    name: '', 
    description: '', 
    price: '', 
    category: '', 
    stock_quantity: '',
    minimum_order_quantity: '1',
    image_urls: [] 
  });
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [showViewProductModal, setShowViewProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showViewOrderModal, setShowViewOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Warehouse selection states
  const [counties, setCounties] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(false);
  
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Fetch counties on mount
  useEffect(() => {
    fetch(getApiUrl('/api/location/counties'))
      .then(res => res.json())
      .then(data => {
        if (data.success) setCounties(data.data);
      })
      .catch(err => console.error('Error fetching counties:', err));
  }, []);

  // Fetch warehouses when county changes
  useEffect(() => {
    if (selectedCounty) {
      setLoadingLocations(true);
      fetch(getApiUrl(`/api/public/warehouses/county/${selectedCounty}`))
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setWarehouses(data.data);
            setSelectedWarehouse(''); // Reset selection
          }
        })
        .catch(err => console.error('Error fetching warehouses:', err))
        .finally(() => setLoadingLocations(false));
    } else {
      setWarehouses([]);
    }
  }, [selectedCounty]);

  const copyTextToClipboard = async (text: string, successMessage: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      toast.success(successMessage);
    } catch (error) {
      toast.error('Failed to copy share link');
    }
  };

  const getVendorStoreLink = () => {
    const farmName = user?.vendorData?.farm_name?.trim();
    const vendorId = products.find((product) => product?.vendor_id)?.vendor_id;
    if (!farmName || !vendorId) return '';

    const baseUrl = window.location.origin;
    return `${baseUrl}/products?vendorId=${encodeURIComponent(String(vendorId))}&vendor=${encodeURIComponent(farmName)}`;
  };

  const handleShareStorefront = async () => {
    const farmName = user?.vendorData?.farm_name?.trim();
    const storefrontUrl = getVendorStoreLink();

    if (!farmName || !storefrontUrl) {
      toast.error('Please make sure you have at least one product and a farm name before sharing your storefront.');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${farmName} on KukuSoko`,
          text: `Browse products from ${farmName} on KukuSoko.`,
          url: storefrontUrl,
        });
        return;
      } catch (error) {
        // Fall back to clipboard if sharing is cancelled or unavailable.
      }
    }

    await copyTextToClipboard(storefrontUrl, 'Storefront link copied');
  };

  const handleShareProductLink = async (product: any) => {
    const productUrl = `${window.location.origin}/product/${product.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on KukuSoko.`,
          url: productUrl,
        });
        return;
      } catch (error) {
        // Fall back to clipboard if sharing is cancelled or unavailable.
      }
    }

    await copyTextToClipboard(productUrl, 'Product link copied');
  };

  
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
  
  // Profile edit form state
  const [profileFormData, setProfileFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    farm_name: '',
    farm_description: '',
    location: '',
    id_number: '',
    county_id: null as number | null,
    constituency_id: null as number | null,
    ward_id: null as number | null
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  
  // AI Assistant states
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [nameSuggestions, setNameSuggestions] = useState<any>(null);
  const [isImageVerified, setIsImageVerified] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const analysisSectionRef = useRef<HTMLDivElement>(null);
  const errorSectionRef = useRef<HTMLDivElement>(null);
  const modalScrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Always wait for auth to finish loading first
    if (authLoading) {
      return;
    }
    
    const token = localStorage.getItem('token');
    
    // If no token at all, redirect to login
    if (!token) {
      window.location.href = '/login';
      return;
    }
    
    // After auth finishes loading, check if we have a user
    // If no user but token exists, try to fetch user first
    if (!user) {
      // Token exists but no user - this might happen when navigating back
      // Try to fetch user from AuthContext
      fetchUser().then(() => {
        // After fetchUser completes, this useEffect will run again
        // because user is in the dependency array
      }).catch(() => {
        // If fetchUser fails, check if token is still valid
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
          window.location.href = '/login';
        }
      });
      return;
    }
    
    // Only proceed if user is a vendor
    if (user.role !== 'vendor') {
      window.location.href = '/login';
      return;
    }
    
    // Skip if already loading to prevent duplicate requests
    // But only if we already have some data (to avoid infinite loading)
    if (loading && (stats || products.length > 0 || orders.length > 0)) {
      return;
    }
    
    setLoading(true);
    if (import.meta.env.DEV) {
      console.log('Fetching vendor dashboard data...');
    }
    
    // Wrap each fetch in a try-catch to handle errors gracefully
    const safeFetch = async (url: string, name: string) => {
      try {
        const response = await fetch(url, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        if (import.meta.env.DEV) {
          console.log(`${name} API response:`, response.status);
        }
        return response;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(`${name} API fetch error:`, error);
        }
        return null;
      }
    };
    
    Promise.all([
      safeFetch(getApiUrl('/api/vendor/stats'), 'Stats'),
      safeFetch(getApiUrl('/api/vendor/products'), 'Products'),
      safeFetch(getApiUrl('/api/vendor/orders') + '?t=' + Date.now(), 'Orders'),
      safeFetch(getApiUrl('/api/vendor/earnings'), 'Earnings'),
      safeFetch(getApiUrl('/api/vendor/advertisements'), 'Advertisements'),
    ]).then(async ([statsRes, productsRes, ordersRes, earningsRes, adsRes]) => {
      if (import.meta.env.DEV) {
        console.log('API responses received:', {
          stats: statsRes?.status || 'failed',
          products: productsRes?.status || 'failed',
          orders: ordersRes?.status || 'failed',
          earnings: earningsRes?.status || 'failed',
          ads: adsRes?.status || 'failed'
        });
      }
      
      // Check if all requests returned 401 - token is expired
      const all401 = statsRes?.status === 401 && productsRes?.status === 401 && 
                    ordersRes?.status === 401 && earningsRes?.status === 401 && 
                    adsRes?.status === 401;
      
      if (all401) {
        // All requests failed with 401 - token is expired
        if (import.meta.env.DEV) {
          console.warn('All API requests returned 401 - token expired');
        }
        setLoading(false);
        // Let AuthContext handle token removal
        return;
      }
      
      // Handle responses - parse JSON safely
      const parseResponse = async (res: Response | null, name: string) => {
        if (!res) return null;
        if (res.status === 401) {
          // 401 error - don't log as error, just return null
          if (import.meta.env.DEV) {
            console.warn(`${name} API returned 401 (unauthorized)`);
          }
          return null;
        }
        if (!res.ok) {
          if (import.meta.env.DEV) {
            console.warn(`${name} API failed with status:`, res.status);
          }
          return null;
        }
        try {
          return await res.json();
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error(`Failed to parse ${name} JSON:`, e);
          }
          return null;
        }
      };
      
      // Parse all responses
      const [stats, products, orders, earnings, ads] = await Promise.all([
        parseResponse(statsRes, 'Stats'),
        parseResponse(productsRes, 'Products'),
        parseResponse(ordersRes, 'Orders'),
        parseResponse(earningsRes, 'Earnings'),
        parseResponse(adsRes, 'Advertisements'),
      ]);
      
      setStats(stats);
      setProducts(Array.isArray(products) ? products : []);
      setOrders(Array.isArray(orders) ? orders : []);
      setEarnings(earnings?.success ? earnings : null);
      
      // Ensure advertisements is always an array and log for debugging
      if (Array.isArray(ads)) {
        setAdvertisements(ads);
        if (import.meta.env.DEV && ads.length > 0) {
          const adsArray = ads as any[];
          console.log('Advertisements loaded:', adsArray.length);
          console.log('First ad:', adsArray[0]);
          console.log('First ad price:', adsArray[0].price, 'type:', typeof adsArray[0].price);
          const totalSpent = adsArray.reduce((sum: number, ad: any) => {
            const price = ad?.price ? parseFloat(String(ad.price)) : 0;
            return sum + (isNaN(price) ? 0 : price);
          }, 0);
          console.log('Total spent calculation:', totalSpent);
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn('Advertisements response is not an array:', ads);
        }
        setAdvertisements([]);
      }

      setLoading(false);
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch vendor data:', error);
      }
      // Always set loading to false, even on error
      setLoading(false);
      // Only show error toast if it's not a 401 (401 is handled by AuthContext)
      if (!error?.message?.includes('401')) {
        toast.error("Failed to load some dashboard data. Please refresh the page.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);
  
  // Listen for order status updates from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orderStatusUpdate' && e.newValue) {
        try {
          const update = JSON.parse(e.newValue);
          if (update.source === 'admin') {
            // Refresh orders when admin makes changes
            const token = localStorage.getItem('token');
            if (token) {
              fetch(getApiUrl('/api/vendor/orders') + '?t=' + Date.now(), { 
                headers: { 
                  Authorization: `Bearer ${token}`
                } 
              })
                .then(r => r.json())
                .then(orders => setOrders(Array.isArray(orders) ? orders : []));
              
              fetch(getApiUrl('/api/vendor/stats'), { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(stats => setStats(stats));
              
              fetch(getApiUrl('/api/vendor/earnings'), { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(earnings => setEarnings(earnings?.success ? earnings : null));
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

  // Auto-refresh has been removed - user will manually refresh the page when needed

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'processing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'shipped': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const createProduct = async (product: any) => {
    const token = localStorage.getItem('token');
    await fetch(getApiUrl('/api/vendor/products'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(product),
    });
    fetchProducts();
  };


  const confirmDeleteProduct = (id: string) => {
    setProductToDelete(id);
    setShowDeleteConfirm(true);
  };

  const deleteProduct = async () => {
    if (!productToDelete) return;
    
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(getApiUrl(`/api/vendor/products/${productToDelete}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Product has been successfully deleted.");
        fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete product. Please try again.");
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setShowDeleteConfirm(false);
      setProductToDelete(null);
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
    const token = localStorage.getItem('token');
    setSubmitting(true);
    
    let finalStatusNotes = statusNotes || '';
    
    // If confirming order, include warehouse info
    if (newStatus === 'confirmed' || newStatus === 'processing') {
      if (selectedWarehouse) {
        const warehouse = warehouses.find(w => w.id.toString() === selectedWarehouse);
        if (warehouse) {
          const warehouseNote = `Vendor will drop off at: ${warehouse.name} (${warehouse.address || ''})`;
          finalStatusNotes = finalStatusNotes ? `${finalStatusNotes}. ${warehouseNote}` : warehouseNote;
        }
      }
    }
    
    // Optimistically update the UI immediately
    const updatedOrders = orders.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus, status_notes: finalStatusNotes, updated_at: new Date().toISOString() }
        : order
    );
    setOrders(updatedOrders);
    
    // Update selected order in modal if it's the same order
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus, status_notes: finalStatusNotes });
    }
    
    try {
      const response = await fetch(getApiUrl(`/api/vendor/orders/status?id=${orderId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          status: newStatus, 
          status_notes: finalStatusNotes,
          warehouse_id: selectedWarehouse ? parseInt(selectedWarehouse) : null
        }),
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
        // Refresh orders and earnings after status update
        const token = localStorage.getItem('token');
        if (token) {
          // Refresh orders
          fetch(getApiUrl('/api/vendor/orders') + '?t=' + Date.now(), { 
            headers: { Authorization: `Bearer ${token}` } 
          })
            .then(r => r.json())
            .then(ordersData => setOrders(Array.isArray(ordersData) ? ordersData : []));
          
          // Refresh earnings if order was delivered
          if (newStatus === 'delivered') {
            setTimeout(() => {
              fetch(getApiUrl('/api/vendor/earnings'), { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(earningsData => setEarnings(earningsData?.success ? earningsData : null));
            }, 500);
          }
        }
        
        toast.success(`Order status has been updated to ${newStatus}.`);
        
        // Refresh stats to update pending orders count
        const statsRes = await fetch(getApiUrl('/api/vendor/stats'), { headers: { Authorization: `Bearer ${token}` } });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
        
        // Notify other tabs about the status change
        localStorage.setItem('orderStatusUpdate', JSON.stringify({
          orderId,
          newStatus,
          timestamp: Date.now(),
          source: 'vendor'
        }));
        
        setShowViewOrderModal(false);
        setSelectedOrder(null);
      } else {
        // Revert optimistic update on failure
        const res = await fetch(getApiUrl('/api/vendor/orders') + '?t=' + Date.now(), { 
          headers: { 
            Authorization: `Bearer ${token}`
          } 
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : []);
        }
        
        const error = await response.json();
        toast.error(error.error || "Failed to update order status. Please try again.");
        if (import.meta.env.DEV) {
          console.error('Failed to update order status:', error);
        }
      }
    } catch (error) {
      // Revert optimistic update on network error
      const res = await fetch(getApiUrl('/api/vendor/orders') + '?t=' + Date.now(), { 
        headers: { 
          Authorization: `Bearer ${token}`
        } 
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
      
      toast.error("Network error. Please try again.");
      if (import.meta.env.DEV) {
        console.error('Network error:', error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const editProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      stock_quantity: product.stock_quantity,
      minimum_order_quantity: product.minimum_order_quantity || 1,
      image_urls: product.image_urls ? JSON.parse(product.image_urls) : []
    });
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/vendor/products/${editingProduct.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description,
          price: parseFloat(productForm.price),
          category: productForm.category,
          stock_quantity: parseInt(productForm.stock_quantity),
          minimum_order_quantity: parseInt(productForm.minimum_order_quantity) || 1,
          image_urls: productForm.image_urls
        }),
      });

      if (response.ok) {
        toast.success("Product has been successfully updated.");
        setShowEditProductModal(false);
        setEditingProduct(null);
        setProductForm({ name: '', description: '', price: '', category: '', stock_quantity: '', minimum_order_quantity: '1', image_urls: [] });
        fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update product. Please try again.");
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setProducts([]);
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/vendor/products'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        // Token expired - only remove if it's still the same token (not already removed)
        const currentToken = localStorage.getItem('token');
        if (currentToken === token) {
          localStorage.removeItem('token');
          fetchUser(); // Trigger auth refresh
        }
        return;
      }
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch products:', error);
      }
      setProducts([]);
    }
  };

  const fetchOrders = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setOrders([]);
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/vendor/orders') + '?t=' + Date.now(), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        // Token expired - only remove if it's still the same token (not already removed)
        const currentToken = localStorage.getItem('token');
        if (currentToken === token) {
          localStorage.removeItem('token');
          fetchUser(); // Trigger auth refresh
        }
        return;
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch orders:', error);
      }
      setOrders([]);
    }
  };

  const fetchEarnings = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setEarnings(null);
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/vendor/earnings'), { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        // Token expired - only remove if it's still the same token (not already removed)
        const currentToken = localStorage.getItem('token');
        if (currentToken === token) {
          localStorage.removeItem('token');
          fetchUser(); // Trigger auth refresh
        }
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setEarnings(data);
      } else {
        setEarnings(null);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch earnings:', error);
      }
      setEarnings(null);
    }
  };

  // Map database category to frontend dropdown value
  const mapDatabaseCategoryToDropdown = (dbCategory: string): string => {
    if (!dbCategory) return '';
    
    const categoryMap: { [key: string]: string } = {
      'chickens': 'chickens',
      'chicks': 'chickens', // Map chicks to chickens since dropdown doesn't have chicks
      'eggs': 'eggs',
      'feed': 'feed',
      'equipment': 'equipment',
      'medicine': 'medication', // Map medicine to medication (dropdown uses medication)
      'medication': 'medication',
      'other': 'other'
    };
    
    const normalized = dbCategory.toLowerCase().trim();
    return categoryMap[normalized] || 'other';
  };

  const buildNonPoultryMessage = (analysis?: any, rejectionReason?: string) => {
    const detectedObjects = Array.isArray(analysis?.detected_objects)
      ? analysis.detected_objects.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
      : [];
    const imageDescription = typeof analysis?.image_description === 'string'
      ? analysis.image_description.trim()
      : '';
    const rawReason = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
    let cleanedReason = rawReason
      .replace(/not poultry[- ]related\.?/ig, '')
      .replace(/please upload.*$/ig, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/image must show|please upload|poultry products|does not contain poultry|not poultry/i.test(cleanedReason)) {
      cleanedReason = '';
    }
    let detectedText = '';
    if (detectedObjects.length > 0) {
      detectedText = detectedObjects.join(', ');
    } else if (imageDescription) {
      detectedText = imageDescription;
    } else if (cleanedReason) {
      detectedText = cleanedReason;
    } else {
      detectedText = 'unknown object';
    }
    detectedText = detectedText.replace(/[.]+$/g, '').trim();
    return `Image verification failed. The image shows ${detectedText}, which is not poultry-related. Please upload another poultry-related image.`;
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Reset file input to allow re-uploading the same file
    const input = e.target;
    const files = input.files;
    
    setUploadError(null);
    // Clear previous analysis and suggestions when starting a new upload
    setAiAnalysis(null);
    setNameSuggestions(null);
    setIsImageVerified(false);
    setIsAnalyzing(true); // Start analyzing indicator
    
    if (!files || files.length === 0) {
      setIsAnalyzing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setUploading(true);
    const token = localStorage.getItem('token');
    
    // Validate all files first
    const validFiles = Array.from(files).filter(file => {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        setUploadError('Only JPG, PNG, WEBP, or GIF images are allowed.');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB max
        setUploadError('Image size must be less than 5MB.');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      setUploading(false);
      setIsAnalyzing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    // Upload only the first file (single image per product)
    const formData = new FormData();
    formData.append('images[]', validFiles[0]); // Only upload first image
    
    try {
      const res = await fetch(getApiUrl('/api/upload/multiple'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      
      // Handle verification errors and successful uploads
      if (!res.ok || !data.success) {
        // Show verification errors
        const errorMessages = data.errors || [];
        if (data.error) {
          if (!errorMessages.includes(data.error)) {
            errorMessages.push(data.error);
          }
        }
        
        let rejectionReason = data.rejection_reason || '';
        if (rejectionReason && !errorMessages.includes(rejectionReason)) {
          errorMessages.push(rejectionReason);
        }
        
        if (errorMessages.length > 0) {
          const errorMessage = errorMessages.join('. ');
          const isNonPoultry = data?.verification?.is_poultry_related === false
            || data?.verification?.analysis?.is_poultry_related === false
            || errorMessages.some((message: string) => message.toLowerCase().includes('not poultry'));
          const rejectionReason = data?.rejection_reason || (isNonPoultry ? errorMessage : '');
          const nonPoultryMessage = isNonPoultry
            ? buildNonPoultryMessage(data?.verification?.analysis, rejectionReason)
            : null;
          setUploadError(nonPoultryMessage || errorMessage);
          setIsImageVerified(false);
          setIsAnalyzing(false);
          
          // Scroll to error section after a brief delay
          setTimeout(() => {
            if (errorSectionRef.current && modalScrollContainerRef.current) {
              const container = modalScrollContainerRef.current;
              const element = errorSectionRef.current;
              // Calculate scroll position: element position relative to container
              const elementTop = element.offsetTop;
              // Scroll to center the error section in view
              const containerHeight = container.clientHeight;
              const elementHeight = element.clientHeight;
              container.scrollTo({
                top: elementTop - (containerHeight / 2) + (elementHeight / 2),
                behavior: 'smooth'
              });
            }
          }, 100);
          
          toast.error(nonPoultryMessage || errorMessage);
        } else {
          setUploadError('Upload failed. Please try again.');
          setIsImageVerified(false);
          setIsAnalyzing(false);
          
          setTimeout(() => {
            if (errorSectionRef.current && modalScrollContainerRef.current) {
              const container = modalScrollContainerRef.current;
              const element = errorSectionRef.current;
              const elementTop = element.offsetTop;
              const containerHeight = container.clientHeight;
              const elementHeight = element.clientHeight;
              container.scrollTo({
                top: elementTop - (containerHeight / 2) + (elementHeight / 2),
                behavior: 'smooth'
              });
            }
          }, 100);
          
          toast.error('Upload failed. Please try again.');
        }
        setUploading(false);
        // Reset input after error
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Only add verified images to the form (replace existing images - single image per product)
      if (data.uploaded && data.uploaded.length > 0) {
        const verifiedUploads = data.uploaded.filter((upload: any) => upload.verification?.verified === true);
        
        if (verifiedUploads.length > 0) {
          // Replace existing images with the new verified image (single image only)
          const verifiedUrl = verifiedUploads[0].url;
          setProductForm((prev: any) => ({ 
            ...prev, 
            image_urls: [verifiedUrl] // Replace, don't append
          }));
          
          // Set AI analysis from the first verified image's verification data
          const firstVerified = verifiedUploads[0];
          if (firstVerified.verification?.analysis) {
            const analysis = firstVerified.verification.analysis;
            
            // Only use analysis if it doesn't contain errors
            if (!analysis.error && analysis.analysis_method !== 'error') {
              // Always update analysis state with the latest results
              setAiAnalysis(analysis);
              setIsImageVerified(true); // Mark image as verified
              setIsAnalyzing(false); // Stop analyzing indicator
              
              // Auto-scroll to analysis section on success
              setTimeout(() => {
                if (analysisSectionRef.current && modalScrollContainerRef.current) {
                  const container = modalScrollContainerRef.current;
                  const element = analysisSectionRef.current;
                  // Calculate scroll position: element position relative to container
                  const elementTop = element.offsetTop;
                  // Scroll to show element at the top of the visible area (with 20px padding)
                  container.scrollTo({
                    top: elementTop - 20,
                    behavior: 'smooth'
                  });
                }
              }, 300);
              
              // Auto-fill/update category based on image analysis
              // Use database_category first, then category_suggestion, then fallback
              let suggestedCategory = analysis.database_category;
              
              // If no database_category, try to map from category_suggestion
              if (!suggestedCategory && analysis.category_suggestion) {
                // Map AI category suggestion to database category
                const aiCategory = analysis.category_suggestion.toLowerCase().trim();
                const categoryMapping: { [key: string]: string } = {
                  'live poultry': 'chickens',
                  'poultry': 'chickens',
                  'chickens': 'chickens',
                  'chicken': 'chickens',
                  'chicks': 'chickens',
                  'chick': 'chickens',
                  'eggs': 'eggs',
                  'egg': 'eggs',
                  'feed & nutrition': 'feed',
                  'feed': 'feed',
                  'nutrition': 'feed',
                  'equipment': 'equipment',
                  'poultry meat': 'chickens',
                  'meat': 'chickens',
                  'medication': 'medication',
                  'medicine': 'medication',
                  'other': 'other'
                };
                
                suggestedCategory = categoryMapping[aiCategory] || 'other';
              }
              
              // Map database category to frontend dropdown value
              let categoryUpdated = false;
              let mappedCategory = '';
              if (suggestedCategory) {
                const dropdownValue = mapDatabaseCategoryToDropdown(suggestedCategory);
                mappedCategory = dropdownValue;
                const currentCategory = productForm.category;
                
                // Only update if different from current category
                if (currentCategory !== dropdownValue) {
                  setProductForm((prev: any) => ({
                    ...prev,
                    category: dropdownValue
                  }));
                  categoryUpdated = true;
                }
              }
              
              // Generate description and name suggestions if we have product name
              // Use the mapped dropdown category
              const categoryToUse = mappedCategory || productForm.category;
              if (productForm.name && categoryToUse) {
                await generateDescriptionWithAI();
              }
              
              // Show combined toast notification
              const toastMessage = categoryUpdated && mappedCategory
                ? `Image verified. Category set to "${mappedCategory.charAt(0).toUpperCase() + mappedCategory.slice(1)}" based on image analysis.`
                : "Image successfully verified and uploaded.";
              
              toast.success(toastMessage);
            } else {
              // Clear analysis if it contains errors
              setAiAnalysis(null);
              setIsImageVerified(false);
              setIsAnalyzing(false);
            }
          } else {
            // Clear analysis if no verified image found
            setAiAnalysis(null);
            setIsImageVerified(false);
            setIsAnalyzing(false);
          }
          // Reset input after successful processing
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else {
          // All images were rejected
          const rejectionMessage = buildNonPoultryMessage();
          setUploadError(rejectionMessage);
          setIsImageVerified(false);
          setIsAnalyzing(false);
          setProductForm((prev: any) => ({ 
            ...prev, 
            image_urls: [] // Clear images if rejected
          }));
          
          // Scroll to error section
          setTimeout(() => {
            if (errorSectionRef.current && modalScrollContainerRef.current) {
              const container = modalScrollContainerRef.current;
              const element = errorSectionRef.current;
              const elementTop = element.offsetTop;
              const containerHeight = container.clientHeight;
              const elementHeight = element.clientHeight;
              container.scrollTo({
                top: elementTop - (containerHeight / 2) + (elementHeight / 2),
                behavior: 'smooth'
              });
            }
          }, 100);
          
          toast.error(rejectionMessage);
          // Reset input after rejection
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      } else {
        setUploadError('No images were uploaded. Please try again.');
        setIsImageVerified(false);
        setIsAnalyzing(false);
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Upload failed. Please try again.');
      setIsImageVerified(false);
      setIsAnalyzing(false);
      
      setTimeout(() => {
        if (errorSectionRef.current && modalScrollContainerRef.current) {
          const container = modalScrollContainerRef.current;
          const element = errorSectionRef.current;
          const elementTop = element.offsetTop;
          const containerHeight = container.clientHeight;
          const elementHeight = element.clientHeight;
          container.scrollTo({
            top: elementTop - (containerHeight / 2) + (elementHeight / 2),
            behavior: 'smooth'
          });
        }
      }, 100);
      
      toast.error(err.message || 'Upload failed. Please try again.');
      // Reset input after error
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    
    setUploading(false);
  };

  // AI Image Analysis function (now mainly for re-analyzing existing images)
  // Note: Images are now automatically verified during upload, so this is for manual re-analysis
  const analyzeImageWithAI = async (imageUrl: string) => {
    setAiLoading(true);
    // Clear previous analysis when starting new analysis
    setAiAnalysis(null);
    try {
      const response = await fetch(getApiUrl('/api/ai/analyze-image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl })
      });

      const data = await response.json();
      if (data.success) {
        // Always update with latest analysis results
        setAiAnalysis(data.analysis);
        
        // Auto-fill form based on AI analysis
        if (data.analysis.category_suggestion && !productForm.category) {
          setProductForm(prev => ({
            ...prev,
            category: data.analysis.category_suggestion
          }));
        }
        
        // Generate description if we have a product name
        if (productForm.name && productForm.category) {
          await generateDescriptionWithAI();
        }
      } else {
        // Clear analysis on error
        setAiAnalysis(null);
        toast.error(data.error || 'Failed to analyze image');
      }
    } catch (error: any) {
      // Clear analysis on error
      setAiAnalysis(null);
      if (import.meta.env.DEV) {
        console.error('AI analysis error:', error);
      }
      toast.error(error.message || 'Failed to analyze image');
    } finally {
      setAiLoading(false);
    }
  };

  // AI Description Generation function
  const generateDescriptionWithAI = async () => {
    if (!productForm.name || !productForm.category) return;
    
    // Don't generate description if image analysis contains errors
    if (aiAnalysis && (aiAnalysis.error || aiAnalysis.analysis_method === 'error')) {
      if (import.meta.env.DEV) {
        console.log('Skipping description generation - image analysis contains errors');
      }
      return;
    }
    
    setAiLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/ai/generate-description'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productForm.name,
          category: productForm.category,
          image_analysis: aiAnalysis && !aiAnalysis.error ? aiAnalysis : null,
          additional_info: []
        })
      });

      const data = await response.json();
      if (data.success) {
        // Set description if generated and not already set
        if (data.description && !productForm.description) {
          setProductForm(prev => ({
            ...prev,
            description: data.description
          }));
          toast.success("AI has generated a product description for you.");
        }
        
        // Set name suggestions if available
        if (data.name_suggestions) {
          setNameSuggestions(data.name_suggestions);
          
          // Show warning if there's a mismatch
          if (data.name_suggestions.has_mismatch && data.name_suggestions.suggested_name) {
            toast.info(`The product name doesn't match the image. Image shows: ${data.name_suggestions.detected_items.join(', ')}. Click "Use Suggested Name" to update.`);
          }
        }
      } else if (!data.success && data.error) {
        if (import.meta.env.DEV) {
          console.warn('Description generation failed:', data.error);
        }
      }
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Description generation error:', error);
      }
    } finally {
      setAiLoading(false);
    }
  };
  
  // Handle accepting suggested product name
  const handleAcceptSuggestedName = () => {
    if (nameSuggestions?.suggested_name) {
      setProductForm(prev => ({
        ...prev,
        name: nameSuggestions.suggested_name
      }));
      setNameSuggestions(null); // Clear suggestions after accepting
      toast.success("Product name has been updated to match the image.");
    }
  };

  const removeImage = (url: string) => {
    setProductForm((prev: any) => ({ ...prev, image_urls: (prev.image_urls || []).filter((u: string) => u !== url) }));
    // Clear analysis when image is removed
    setAiAnalysis(null);
    setNameSuggestions(null);
    setIsImageVerified(false);
    setIsAnalyzing(false);
  };

  // Drag-to-reorder logic
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };
  const handleDragEnterThumb = (index: number) => {
    dragOverItem.current = index;
  };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newList = [...(productForm.image_urls || [])];
    const dragged = newList.splice(dragItem.current, 1)[0];
    newList.splice(dragOverItem.current, 0, dragged);
    setProductForm((prev: any) => ({ ...prev, image_urls: newList }));
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleProductFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductForm((prev: any) => ({ ...prev, [name]: value }));
  };

  // Profile edit functions
  const openEditProfileModal = () => {
    if (user) {
      setProfileFormData({
        full_name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        farm_name: user.vendorData?.farm_name || '',
        farm_description: user.vendorData?.farm_description || '',
        location: user.vendorData?.location || '',
        id_number: user.vendorData?.id_number || '',
        county_id: (user.vendorData as any)?.county_id || null,
        constituency_id: (user.vendorData as any)?.constituency_id || null,
        ward_id: (user.vendorData as any)?.ward_id || null
      });
    }
    setShowEditProfileModal(true);
  };

  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Prepare payload with location IDs
      const payload = {
        ...profileFormData,
        county_id: profileFormData.county_id || null,
        constituency_id: profileFormData.constituency_id || null,
        ward_id: profileFormData.ward_id || null
      };
      
      const response = await fetch(getApiUrl('/api/vendor/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Refresh user data
        await fetchUser();
        setShowEditProfileModal(false);
        // Show success notification
        toast.success("Your profile has been updated successfully!");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      // Show error notification
      toast.error(error instanceof Error ? error.message : "Failed to update profile. Please try again.");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/vendor/products'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description,
          price: parseFloat(productForm.price),
          category: productForm.category,
          stock_quantity: parseInt(productForm.stock_quantity),
          minimum_order_quantity: parseInt(productForm.minimum_order_quantity) || 1,
          image_urls: productForm.image_urls,
          ai_analysis: aiAnalysis // Include AI verification data for database storage
        })
      });

      if (response.ok) {
        // Reset form
        setProductForm({ 
          name: '', 
          description: '', 
          price: '', 
          category: '', 
          stock_quantity: '',
          image_urls: [] 
        });
        setAiAnalysis(null);
        setNameSuggestions(null);
        setIsImageVerified(false);
        setIsAnalyzing(false);
        setUploadError(null);
        setShowAddProductModal(false);
        
        // Refresh products list
        const token = localStorage.getItem('token');
        const res = await fetch(getApiUrl('/api/vendor/products'), { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
        
        toast.success("Product has been submitted successfully! It will be reviewed by admin before going live.");
      } else {
        const error = await response.json();
        const errorMessage = error.error || 'Failed to submit product';
        
        // Check if it's a description length error
        if (errorMessage.includes('Description is too short') || errorMessage.includes('Description is too long')) {
          toast.error(errorMessage);
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <Navbar />
      
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          type="vendor"
          stats={{
            pendingOrders: stats?.pendingOrders || 0,
            totalOrders: stats?.totalOrders || 0
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
                aria-label="Open sidebar menu"
                title="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex items-center space-x-2">
                <NotificationsMenu />
              </div>
            </div>

            {/* Header */}
            <div className="mb-6 sm:mb-8 px-2 sm:px-0">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">Vendor Dashboard</h1>
                  <p className="text-gray-600 mt-2 text-sm sm:text-base">Welcome back, {user?.name || user?.name || user?.email || 'Vendor'}!</p>
                </div>
                <div className="hidden lg:flex items-center space-x-2 sm:space-x-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md px-3 sm:px-4 py-2 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-xs sm:text-sm text-gray-600">Notifications:</span>
                      <NotificationsMenu />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Products</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">{stats ? (stats.totalProducts || 0) : 'Loading...'}</p>
                  </div>
                  <Package className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-accent flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Orders</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">{stats ? (stats.totalOrders || 0) : 'Loading...'}</p>
                  </div>
                  <Users className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-accent flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Sales</p>
                    <p className="text-sm sm:text-lg md:text-2xl font-bold text-primary truncate">KSH {stats ? (stats.totalRevenue || 0) : 'Loading...'}</p>
                  </div>
                  <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-accent flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Spent on Ads</p>
                    <p className="text-sm sm:text-lg md:text-2xl font-bold text-orange-600 whitespace-normal break-words">
                      {(() => {
                        if (!Array.isArray(advertisements)) {
                          return 'KSh 0.00';
                        }
                        const total = advertisements.reduce((sum: number, ad: any) => {
                          const price = ad?.price ? parseFloat(String(ad.price)) : 0;
                          return sum + (isNaN(price) ? 0 : price);
                        }, 0);
                        return `KSh ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      })()}
                    </p>
                  </div>
                  <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-orange-600 flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Pending Orders</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">{stats ? (stats.pendingOrders || 0) : 'Loading...'}</p>
                  </div>
                  <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                    <span className="text-xs sm:text-sm text-yellow-800 font-bold">{stats ? (stats.pendingOrders || 0) : '...'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-lg shadow-md mb-6 w-full">
            <div className="p-4 sm:p-6 w-full">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div id="tab-section-overview" className="space-y-6 scroll-mt-24">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h2 className="text-xl font-semibold text-primary">Recent Activity</h2>
                    <Button 
                      className="btn-primary flex items-center w-full sm:w-auto"
                      onClick={() => {
                        // Reset form state when opening modal
                        setProductForm({ 
                          name: '', 
                          description: '', 
                          price: '', 
                          category: '', 
                          stock_quantity: '',
                          image_urls: [] 
                        });
                        setAiAnalysis(null);
                        setNameSuggestions(null);
                        setIsImageVerified(false);
                        setUploadError(null);
                        setShowAddProductModal(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Product
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
                    <Card className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">Latest Orders</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="space-y-3">
                          {orders.slice(0, 3).map(order => (
                            <div key={order.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <div>
                                <p className="font-medium text-sm">{order.customer}</p>
                                <p className="text-xs text-gray-500">{order.product}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-sm">KSH {order.total}</p>
                                <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                                  {order.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">Top Products</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="space-y-3">
                          {(products || []).slice(0, 3).map(product => (
                            <div key={product.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <div>
                                <p className="font-medium text-sm">{product.name}</p>
                                <p className="text-xs text-gray-500">{product.order_count || 0} orders</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-sm">KSH {product.price}</p>
                                <Badge className={`text-xs ${product.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                  {product.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Bell className="h-5 w-5 mr-2 text-primary" />
                          Notifications
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="space-y-3">
                          <div className="text-center">
                            <NotificationsMenu />
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

              {/* Products Tab */}
              {activeTab === 'products' && (
                <div id="tab-section-products" className="space-y-6 scroll-mt-24">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h2 className="text-xl font-semibold text-primary">My Products</h2>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="flex items-center w-full sm:w-auto"
                        onClick={handleShareStorefront}
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share My Shop
                      </Button>
                      <Button 
                        className="btn-primary flex items-center w-full sm:w-auto"
                        onClick={() => {
                          // Reset form state when opening modal
                          setProductForm({ 
                            name: '', 
                            description: '', 
                            price: '', 
                            category: '', 
                            stock_quantity: '',
                            image_urls: [] 
                          });
                          setAiAnalysis(null);
                          setNameSuggestions(null);
                          setIsImageVerified(false);
                          setUploadError(null);
                          setShowAddProductModal(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Product
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Product</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Price</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Stock</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Orders</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {(products || []).map(product => (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 max-w-[150px] sm:max-w-none truncate" title={product.name}>
                                    {product.name}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">KSH {product.price}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">{product.stock_quantity || 0}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <Badge className={`text-xs ${product.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                    {product.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">{product.order_count || 0}</td>
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
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => editProduct(product)}
                                      title="Edit product"
                                      className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                                    >
                                      <Edit className="h-4 w-4" />
                                      <span className="hidden sm:inline ml-1">Edit</span>
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleShareProductLink(product)}
                                      title="Share product link"
                                      className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                                    >
                                      <Share2 className="h-4 w-4" />
                                      <span className="hidden sm:inline ml-1">Share</span>
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => confirmDeleteProduct(product.id)}
                                      title="Delete product"
                                      className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 text-red-600 hover:text-red-700 hover:border-red-300"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="hidden sm:inline ml-1">Delete</span>
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

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div id="tab-section-orders" className="space-y-6 w-full scroll-mt-24">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-primary">Order Management</h2>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Order ID</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Customer</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Product</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Quantity</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Total</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Order Date</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Last Updated</th>
                              <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {(orders || []).map(order => (
                              <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">#{order.id}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 max-w-[120px] sm:max-w-none truncate" title={order.customer}>
                                    {order.customer}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 max-w-[150px] sm:max-w-none truncate" title={order.product}>
                                    {order.product}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">{order.quantity}</td>
                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">KSH {order.total}</td>
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
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => viewOrder(order)}
                                    className="text-xs sm:text-sm"
                                  >
                                    View
                                  </Button>
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

              {/* Earnings Tab */}
              {activeTab === 'earnings' && (
                <div id="tab-section-earnings" className="space-y-6 w-full scroll-mt-24">
                  <h2 className="text-xl font-semibold text-primary">Earnings Breakdown</h2>
                  
                  {/* Total Earnings Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Total Earnings</p>
                          <p className="text-2xl font-bold text-green-600">
                            KSH {earnings?.total_earnings?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Commission Rate</p>
                          <p className="text-2xl font-bold text-blue-600">10%</p>
                          <p className="text-xs text-gray-500">Platform Fee</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Your Share</p>
                          <p className="text-2xl font-bold text-primary">90%</p>
                          <p className="text-xs text-gray-500">Net Earnings</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Advertisement Revenue and Earnings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Ad Revenue (Gross)</p>
                          <p className="text-2xl font-bold text-blue-600">
                            KSH {earnings?.ad_revenue?.toFixed(2) || '0.00'}
                          </p>
                          <p className="text-xs text-gray-500">Total from advertisements</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Ad Earnings (Net)</p>
                          <p className="text-2xl font-bold text-green-600">
                            KSH {earnings?.ad_earnings?.toFixed(2) || '0.00'}
                          </p>
                          <p className="text-xs text-gray-500">After commission deduction</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Per-Ad Revenue Breakdown */}
                  {earnings?.ad_revenue_breakdown && earnings.ad_revenue_breakdown.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue by Advertisement</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Advertisement</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Revenue Generated</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {earnings.ad_revenue_breakdown.map((ad: any, index: number) => (
                                <tr key={ad.ad_id || index} className="hover:bg-gray-50">
                                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <div className="max-w-[200px] sm:max-w-none truncate" title={ad.ad_title || `Ad #${ad.ad_id}`}>
                                      {ad.ad_title || `Ad #${ad.ad_id}`}
                                    </div>
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                                    KSH {parseFloat(ad.revenue_generated || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Commission Explanation */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-lg font-semibold text-primary mb-3">How Commission Works</h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>• <strong>Platform Commission:</strong> 10% of each delivered order goes to Poultry Hub Kenya</p>
                        <p>• <strong>Your Earnings:</strong> 90% of each delivered order goes to you</p>
                        <p>• <strong>Commission Processing:</strong> Only triggered when order status is marked as "delivered"</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Earnings Breakdown Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Earnings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {earnings?.earnings_breakdown?.length > 0 ? (
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Order Date</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider">Product</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Order Total</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Commission (10%)</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Your Earnings</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {earnings.earnings_breakdown.map((earning: any, index: number) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {new Date(earning.order_date).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">
                                    <div className="max-w-[150px] sm:max-w-none truncate" title={earning.product_name}>
                                      {earning.product_name}
                                    </div>
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    KSH {parseFloat(earning.order_total).toFixed(2)}
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-red-600 hidden md:table-cell">
                                    -KSH {parseFloat(earning.commission_amount).toFixed(2)}
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
                                    KSH {parseFloat(earning.net_amount).toFixed(2)}
                                    <div className="text-xs text-gray-500 md:hidden mt-1">
                                      Commission: -KSH {parseFloat(earning.commission_amount).toFixed(2)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No earnings yet. Earnings will appear here once orders are delivered.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Advertisements Tab */}
              {activeTab === 'advertisements' && (
                <div id="tab-section-advertisements" className="space-y-6 scroll-mt-24">
                  <AdvertisementManager />
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div id="tab-section-analytics" className="scroll-mt-24">
                  <VendorAnalytics />
                </div>
              )}

              {/* AI Assistant Tab */}
              {activeTab === 'ai-assistant' && (
                <div id="tab-section-ai-assistant" className="space-y-6 scroll-mt-24">
                  <AIProductAssistant 
                    onImageAnalysis={(analysis) => {
                      if (import.meta.env.DEV) {
                        console.log('Image analysis:', analysis);
                      }
                    }}
                    onDescriptionGenerated={(description) => {
                      if (import.meta.env.DEV) {
                        console.log('Generated description:', description);
                      }
                    }}
                    onContentModerated={(moderation) => {
                      if (import.meta.env.DEV) {
                        console.log('Content moderation:', moderation);
                      }
                    }}
                    onSuggestionsGenerated={(suggestions) => {
                      if (import.meta.env.DEV) {
                        console.log('Product suggestions:', suggestions);
                      }
                    }}
                  />
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div id="tab-section-profile" className="space-y-6 scroll-mt-24">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-primary">Account Details</h2>
                    <Button
                      onClick={openEditProfileModal}
                      className="btn-primary"
                    >
                      Edit Profile
                    </Button>
                  </div>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <p className="text-gray-900 break-all">{user?.email}</p>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <p className="text-gray-900">{user?.name || user?.name || 'Not provided'}</p>
                          </div>
                          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <p className="text-gray-900">{user?.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        
                        <div className="pt-6 border-t border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Vendor Information</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">Farm Name</label>
                              <p className="text-gray-900">{user?.vendorData?.farm_name || 'Not provided'}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">ID Number</label>
                              <p className="text-gray-900">{user?.vendorData?.id_number || 'Not provided'}</p>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <label className="block text-sm font-medium text-gray-700">Farm Description</label>
                              <p className="text-gray-900">{user?.vendorData?.farm_description || 'Not provided'}</p>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                              {(() => {
                                const vendorData = user?.vendorData as any;
                                const hasLocationData = vendorData?.county_name;
                                
                                if (hasLocationData) {
                                  return (
                                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                      <div className="flex items-start gap-3">
                                        <span className="font-medium text-gray-700 min-w-[80px]">County:</span>
                                        <span className="text-gray-900">{vendorData.county_name}</span>
                                      </div>
                                      <div className="flex items-start gap-3">
                                        <span className="font-medium text-gray-700 min-w-[80px]">Subcounty:</span>
                                        <span className="text-gray-900">{vendorData.constituency_name || 'Not provided'}</span>
                                      </div>
                                      <div className="flex items-start gap-3">
                                        <span className="font-medium text-gray-700 min-w-[80px]">Ward:</span>
                                        <span className="text-gray-900">{vendorData.ward_name || 'Not provided'}</span>
                                      </div>
                                      {vendorData.location && (
                                        <div className="pt-3 mt-3 border-t border-gray-200">
                                          <div className="flex items-start gap-3">
                                            <span className="font-medium text-gray-600 text-sm min-w-[80px]">Additional:</span>
                                            <span className="text-gray-600 text-sm">{vendorData.location}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-gray-900">{vendorData?.location || 'Not provided'}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Account Status</h3>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user?.isApproved 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {user?.isApproved ? 'Approved' : 'Pending Approval'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Messages Tab */}
              {activeTab === 'messages' && (
                <div id="tab-section-messages" className="scroll-mt-24">
                  <VendorInbox />
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div ref={modalScrollContainerRef} className="bg-white rounded-lg w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-primary">Add New Product</h2>
                <button 
                  onClick={() => {
                    setShowAddProductModal(false);
                    // Clear all states when closing modal
                    setAiAnalysis(null);
                    setNameSuggestions(null);
                    setIsImageVerified(false);
                    setIsAnalyzing(false);
                    setUploadError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>


              {/* AI Assistant Section */}
              {aiAnalysis && (
                <div ref={analysisSectionRef} className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg scroll-mt-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-800">AI Assistant</h3>
                    {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-blue-800 mb-2">Image Analysis</h4>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Badge className={aiAnalysis.quality_score >= 7 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            Quality: {aiAnalysis.quality_score.toFixed(1)}/10
                          </Badge>
                        </div>
                        {aiAnalysis.detected_objects.length > 0 && (
                          <div>
                            <span className="text-sm text-blue-700">Detected: </span>
                            <span className="text-sm text-blue-600">{aiAnalysis.detected_objects.join(', ')}</span>
                          </div>
                        )}
                        {aiAnalysis.category_suggestion && (
                          <div>
                            <span className="text-sm text-blue-700">Suggested Category: </span>
                            <Badge variant="outline" className="text-blue-600">{aiAnalysis.category_suggestion}</Badge>
                          </div>
                        )}
                        {aiAnalysis.is_poultry_related === false && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-red-800">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">❌ REJECTED - Not Poultry Content</span>
                            </div>
                            <p className="text-xs text-red-700 mt-1">
                              <strong>This image has been rejected by our AI.</strong> Please upload only poultry-related images: chickens, hens, roosters, eggs, feed, grain, or poultry equipment. Other content is not allowed on this marketplace.
                            </p>
                            {aiAnalysis.confidence && (
                              <p className="text-xs text-red-600 mt-1">
                                AI Confidence: {Math.round(aiAnalysis.confidence * 100)}% (Minimum required: 60%)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-blue-800 mb-2">Suggestions</h4>
                      <ul className="space-y-1">
                        {aiAnalysis.suggestions.slice(0, 3).map((suggestion: string, index: number) => (
                          <li key={index} className="text-sm text-blue-600 flex items-start space-x-1">
                            <span className="text-blue-500">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitProduct} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                    <input
                      id="product-name"
                      type="text"
                      name="name"
                      value={productForm.name}
                      onChange={handleProductFormChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter product name"
                    />
                    {/* Name Mismatch Warning */}
                    {nameSuggestions?.has_mismatch && nameSuggestions?.suggested_name && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 text-yellow-800 mb-2">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">Name Mismatch Detected</span>
                            </div>
                            <p className="text-xs text-yellow-700 mb-2">
                              The product name doesn't match the image. Image shows: <strong>{nameSuggestions.detected_items.join(', ')}</strong>
                            </p>
                            <p className="text-xs text-yellow-700 mb-2">
                              Suggested name: <strong>{nameSuggestions.suggested_name}</strong>
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAcceptSuggestedName}
                              className="text-xs bg-yellow-100 hover:bg-yellow-200 border-yellow-300"
                            >
                              Use Suggested Name
                            </Button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNameSuggestions(null)}
                            className="text-yellow-600 hover:text-yellow-800 ml-2"
                            aria-label="Dismiss name suggestions"
                            title="Dismiss suggestions"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                    <select
                      id="category"
                      name="category"
                      value={productForm.category}
                      onChange={handleProductFormChange}
                      required
                      title="Select product category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select category</option>
                      <option value="chickens">Chickens</option>
                      <option value="eggs">Eggs</option>
                      <option value="feed">Feed</option>
                      <option value="equipment">Equipment</option>
                      <option value="medication">Medication</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="product-price" className="block text-sm font-medium text-gray-700 mb-2">Price (KSH) *</label>
                    <input
                      id="product-price"
                      type="number"
                      name="price"
                      value={productForm.price}
                      onChange={handleProductFormChange}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label htmlFor="stock-quantity" className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity *</label>
                    <input
                      id="stock-quantity"
                      type="number"
                      name="stock_quantity"
                      value={productForm.stock_quantity}
                      onChange={handleProductFormChange}
                      required
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label htmlFor="minimum-order-quantity" className="block text-sm font-medium text-gray-700 mb-2">Minimum Order Quantity *</label>
                    <input
                      id="minimum-order-quantity"
                      type="number"
                      name="minimum_order_quantity"
                      value={productForm.minimum_order_quantity}
                      onChange={handleProductFormChange}
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="1"
                    />
                    <p className="mt-1 text-xs text-gray-500">Minimum quantity customers must order</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="product-description" className="block text-sm font-medium text-gray-700">Description *</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateDescriptionWithAI}
                      disabled={aiLoading || !productForm.name || !productForm.category}
                      className="flex items-center space-x-1"
                    >
                      {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      <span>AI Generate</span>
                    </Button>
                  </div>
                  <textarea
                    id="product-description"
                    name="description"
                    value={productForm.description}
                    onChange={handleProductFormChange}
                    required
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Describe your product or use AI to generate one..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center relative overflow-hidden">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className={`cursor-pointer block relative z-0 ${isAnalyzing ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="space-y-2">
                        <div className="mx-auto h-12 w-12 text-gray-400">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">
                          {isAnalyzing ? 'Analyzing Image...' : uploading ? 'Uploading & Verifying...' : 'Click to upload image or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB. One image per product. Images are automatically verified for poultry content.</p>
                      </div>
                    </label>
                    
                    {/* Analyzing Indicator - Inside Upload Box Overlay */}
                    {isAnalyzing && (
                      <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/90 backdrop-blur-sm border-2 border-primary/30 rounded-lg flex items-center justify-center z-20">
                        <div className="flex flex-col items-center space-y-3">
                          <div className="relative">
                            <div className="h-16 w-16 rounded-full border-4 border-gray-100 border-t-primary animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <ShieldCheck className="h-6 w-6 text-primary" />
                            </div>
                          </div>
                          <div className="text-center">
                            <h3 className="text-base font-semibold text-primary">Verifying Image...</h3>
                            <p className="text-xs text-gray-500">Checking for poultry content</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Error Display */}
                  {uploadError && (
                    <div ref={errorSectionRef} className="mt-2 text-sm text-red-600 bg-red-50 border-2 border-red-300 p-4 rounded-lg scroll-mt-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-800 mb-1">Image Verification Failed</p>
                          <p className="text-red-700">{uploadError}</p>
                          <p className="text-xs text-red-600 mt-2 font-medium">
                            💡 Please upload only poultry-related images: chickens, eggs, feed, equipment, etc.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image Preview - Single Image */}
                  {productForm.image_urls && productForm.image_urls.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Uploaded Image:</p>
                      <div className="relative inline-block group">
                        <img
                          src={getImageUrl(productForm.image_urls[0].replace(/\\/g, '/'))}
                          alt="Product"
                          className="w-32 h-32 object-cover rounded-lg border"
                          onError={(e) => {
                            if (import.meta.env.DEV) {
                              console.log('Image failed to load:', productForm.image_urls[0]);
                            }
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProductForm((prev: any) => ({ ...prev, image_urls: [] }));
                            setAiAnalysis(null);
                            setIsImageVerified(false);
                            setIsAnalyzing(false);
                            setNameSuggestions(null);
                            setUploadError(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                    setShowAddProductModal(false);
                    // Clear all states when closing modal
                    setAiAnalysis(null);
                    setNameSuggestions(null);
                    setIsImageVerified(false);
                    setIsAnalyzing(false);
                    setUploadError(null);
                  }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || !isImageVerified}
                    className="btn-primary"
                    title={!isImageVerified ? "Please upload and verify an image before submitting" : ""}
                  >
                    {submitting ? 'Submitting...' : 'Submit Product'}
                  </Button>
                  {!isImageVerified && (
                    <p className="text-xs text-red-600 mt-1">* Image verification required before submission</p>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Product Modal */}
      {showViewProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-primary">Product Details</h2>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {JSON.parse(selectedProduct.image_urls).map((url: string, index: number) => (
                        <div key={index} className="relative">
                          <img
                            src={getImageUrl(url.replace(/\\/g, '/'))}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedProduct.name}</p>
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
                    <p className="text-lg text-gray-900">{selectedProduct.stock_quantity}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <Badge className={getStatusColor(selectedProduct.status)}>
                      {selectedProduct.status}
                    </Badge>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                    <p className="text-sm text-gray-600">{new Date(selectedProduct.created_at).toLocaleDateString()}</p>
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
                <Button
                  onClick={() => {
                    setShowViewProductModal(false);
                    editProduct(selectedProduct);
                  }}
                  className="btn-primary"
                >
                  Edit Product
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditProductModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-primary">Edit Product</h2>
                <button
                  onClick={() => setShowEditProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateProduct} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label htmlFor="edit-product-name" className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                    <input
                      id="edit-product-name"
                      type="text"
                      name="name"
                      value={productForm.name}
                      onChange={handleProductFormChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter product name"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                    <select
                      id="edit-category"
                      name="category"
                      value={productForm.category}
                      onChange={handleProductFormChange}
                      required
                      title="Select product category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select category</option>
                      <option value="chickens">Chickens</option>
                      <option value="eggs">Eggs</option>
                      <option value="feed">Feed</option>
                      <option value="equipment">Equipment</option>
                      <option value="medication">Medication</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-product-price" className="block text-sm font-medium text-gray-700 mb-2">Price (KSH) *</label>
                    <input
                      id="edit-product-price"
                      type="number"
                      name="price"
                      value={productForm.price}
                      onChange={handleProductFormChange}
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-stock-quantity" className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity *</label>
                    <input
                      id="edit-stock-quantity"
                      type="number"
                      name="stock_quantity"
                      value={productForm.stock_quantity}
                      onChange={handleProductFormChange}
                      required
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-minimum-order-quantity" className="block text-sm font-medium text-gray-700 mb-2">Minimum Order Quantity *</label>
                    <input
                      id="edit-minimum-order-quantity"
                      type="number"
                      name="minimum_order_quantity"
                      value={productForm.minimum_order_quantity}
                      onChange={handleProductFormChange}
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="1"
                    />
                    <p className="mt-1 text-xs text-gray-500">Minimum quantity customers must order</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-product-description" className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    id="edit-product-description"
                    name="description"
                    value={productForm.description}
                    onChange={handleProductFormChange}
                    required
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Describe your product..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Images</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="edit-image-upload"
                    />
                    <label htmlFor="edit-image-upload" className="cursor-pointer">
                      <div className="space-y-2">
                        <div className="mx-auto h-12 w-12 text-gray-400">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">
                          {uploading ? 'Uploading & Verifying...' : 'Click to upload images or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB each. Images are automatically verified for poultry content.</p>
                      </div>
                    </label>
                  </div>

                  {/* Upload Error Display */}
                  {uploadError && (
                    <div ref={errorSectionRef} className="mt-2 text-sm text-red-600 bg-red-50 border-2 border-red-300 p-4 rounded-lg scroll-mt-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-800 mb-1">Image Verification Failed</p>
                          <p className="text-red-700">{uploadError}</p>
                          <p className="text-xs text-red-600 mt-2 font-medium">
                            💡 Please upload only poultry-related images: chickens, eggs, feed, equipment, etc.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image Preview */}
                  {productForm.image_urls && productForm.image_urls.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Current Images:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                        {productForm.image_urls.map((url: string, index: number) => (
                          <div key={index} className="relative group">
                            <img
                              src={getImageUrl(url.replace(/\\/g, '/'))}
                              alt={`Product ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragEnter={() => handleDragEnterThumb(index)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => e.preventDefault()}
                              onError={(e) => {
                                if (import.meta.env.DEV) {
                                  console.log('Image failed to load:', url);
                                }
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(url)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditProductModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary"
                  >
                    {submitting ? 'Updating...' : 'Update Product'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Order Details Modal */}
      {showViewOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-primary">Order Details</h2>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                      {JSON.parse(selectedOrder.product_images).map((url: string, index: number) => (
                        <div key={index} className="relative">
                          <img
                            src={url.replace(/\\/g, '/')}
                            alt={`${selectedOrder.product} ${index + 1}`}
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

                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Customer Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                      <p className="text-gray-900">{selectedOrder.contact_phone}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                    <p className="text-gray-900">{selectedOrder.shipping_address}</p>
                  </div>
                </div>

                {/* Product Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary">Product Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                      <p className="text-lg font-semibold text-green-600">KSH {selectedOrder.total}</p>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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

                {/* Delivery/Drop-off Information */}
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <h3 className="text-lg font-semibold text-orange-800 mb-3 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Delivery (Drop-off)
                  </h3>
                  <p className="text-sm text-orange-700 mb-4">
                    Once you confirm the order, please select a warehouse where you will bring the product for us to deliver to the customer.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-orange-900">Select County</Label>
                      <Select 
                        value={selectedCounty} 
                        onValueChange={setSelectedCounty}
                      >
                        <SelectTrigger className="bg-white border-orange-200">
                          <SelectValue placeholder="Select County" />
                        </SelectTrigger>
                        <SelectContent>
                          {counties.map(c => (
                            <SelectItem key={c.county_id} value={c.county_id.toString()}>
                              {c.county_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-orange-900">Select Warehouse</Label>
                      <Select 
                        value={selectedWarehouse} 
                        onValueChange={setSelectedWarehouse}
                        disabled={!selectedCounty || loadingLocations}
                      >
                        <SelectTrigger className="bg-white border-orange-200">
                          <SelectValue placeholder={
                            loadingLocations 
                              ? "Loading..." 
                              : (selectedCounty ? "Select Warehouse" : "Select County first")
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.length > 0 ? (
                            warehouses.map(w => (
                              <SelectItem key={w.id} value={w.id.toString()}>
                                {w.name} - {w.address || 'N/A'}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">
                              {selectedCounty ? "No warehouses in this county" : "Select county first"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Status Update Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">Update Order Status</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
                      <Button
                        key={status}
                        variant={selectedOrder.status === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleUpdateOrderStatus(selectedOrder.id, status)}
                        disabled={submitting}
                        className="capitalize"
                      >
                        {submitting ? (
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

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-primary">Edit Profile</h2>
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        value={profileFormData.full_name}
                        onChange={handleProfileFormChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={profileFormData.email}
                        onChange={handleProfileFormChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={profileFormData.phone}
                        onChange={handleProfileFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>
                </div>

                {/* Farm Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Farm Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="farm_name" className="block text-sm font-medium text-gray-700 mb-1">
                        Farm Name *
                      </label>
                      <input
                        type="text"
                        id="farm_name"
                        name="farm_name"
                        value={profileFormData.farm_name}
                        onChange={handleProfileFormChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter your farm name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location *
                      </label>
                      <LocationSelect
                        countyId={profileFormData.county_id}
                        onCountyChange={(id) => setProfileFormData(prev => ({ ...prev, county_id: id }))}
                        constituencyId={profileFormData.constituency_id}
                        onConstituencyChange={(id) => setProfileFormData(prev => ({ ...prev, constituency_id: id }))}
                        wardId={profileFormData.ward_id}
                        onWardChange={(id) => setProfileFormData(prev => ({ ...prev, ward_id: id }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Select your county, subcounty, and ward for accurate location tracking.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Location Details (Optional)
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={profileFormData.location}
                        onChange={handleProfileFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="e.g., Street name, Landmark, etc."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Optional: Add specific address or landmark details.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="id_number" className="block text-sm font-medium text-gray-700 mb-1">
                        ID Number
                      </label>
                      <input
                        type="text"
                        id="id_number"
                        name="id_number"
                        value={profileFormData.id_number}
                        onChange={handleProfileFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter your ID number"
                      />
                    </div>
                    <div>
                      <label htmlFor="farm_description" className="block text-sm font-medium text-gray-700 mb-1">
                        Farm Description
                      </label>
                      <textarea
                        id="farm_description"
                        name="farm_description"
                        value={profileFormData.farm_description}
                        onChange={handleProfileFormChange}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Describe your farm and what you produce"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditProfileModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={profileSubmitting}
                    className="btn-primary"
                  >
                    {profileSubmitting ? 'Updating...' : 'Update Profile'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
              The product will be permanently removed from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProduct}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      </div>
      <Footer />
    </div>
  );
};

export default VendorDashboard;

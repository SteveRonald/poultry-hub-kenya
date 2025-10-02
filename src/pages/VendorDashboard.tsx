
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Package, BarChart3, Users, Eye, Edit, Trash2, X, Bell, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import NotificationsMenu from '../components/NotificationsMenu';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { getApiUrl } from '../config/api';
import VendorAnalytics from '../components/VendorAnalytics';
import AIProductAssistant from '../components/AIProductAssistant';

const VendorDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productForm, setProductForm] = useState<any>({ 
    name: '', 
    description: '', 
    price: '', 
    category: '', 
    stock_quantity: '',
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
  
  // AI Assistant states
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(getApiUrl('/api/vendor/stats'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/vendor/products'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(getApiUrl('/api/vendor/orders'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([stats, products, orders]) => {
      setStats(stats);
      setProducts(products);
      setOrders(orders);
      setLoading(false);
    });
  }, []);

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


  const deleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      const token = localStorage.getItem('token');
      await fetch(getApiUrl(`/api/vendor/products/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProducts();
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
    try {
      const response = await fetch(getApiUrl(`/api/vendor/orders/status?id=${orderId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, status_notes: statusNotes }),
      });
      
      if (response.ok) {
        // Refresh orders data
        const res = await fetch(getApiUrl('/api/vendor/orders'), { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : []);
        }
        setShowViewOrderModal(false);
        setSelectedOrder(null);
      } else {
        const error = await response.json();
        console.error('Failed to update order status:', error);
      }
    } catch (error) {
      console.error('Network error:', error);
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
          image_urls: productForm.image_urls
        }),
      });

      if (response.ok) {
        alert('Product updated successfully!');
        setShowEditProductModal(false);
        setEditingProduct(null);
        setProductForm({ name: '', description: '', price: '', category: '', stock_quantity: '', image_urls: [] });
        fetchProducts();
      } else {
        const error = await response.json();
        alert('Failed to update product: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to update product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const token = localStorage.getItem('token');
    await fetch(getApiUrl(`/api/vendor/orders/${orderId}/status`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    fetchOrders();
  };

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(getApiUrl('/api/vendor/products'), { headers: { Authorization: `Bearer ${token}` } });
    setProducts(await res.json());
  };

  const fetchOrders = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(getApiUrl('/api/vendor/orders'), { headers: { Authorization: `Bearer ${token}` } });
    setOrders(await res.json());
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
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
      return;
    }
    
    // Upload all files at once
    const formData = new FormData();
    validFiles.forEach(file => {
      formData.append('images[]', file);
    });
    
    try {
      const res = await fetch(getApiUrl('/api/upload/multiple'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      if (data.success && data.uploaded) {
        const newUrls = data.uploaded.map((upload: any) => upload.url);
        setProductForm((prev: any) => ({ 
          ...prev, 
          image_urls: [...(prev.image_urls || []), ...newUrls] 
        }));
        
        // Auto-analyze the first uploaded image with AI
        if (newUrls.length > 0 && !aiAnalysis) {
          await analyzeImageWithAI(newUrls[0]);
        }
      } else {
        setUploadError(data.errors ? data.errors.join(', ') : 'Upload failed');
      }
    } catch (err) {
      setUploadError('Upload failed. Please try again.');
    }
    
    setUploading(false);
  };

  // AI Image Analysis function
  const analyzeImageWithAI = async (imageUrl: string) => {
    setAiLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/ai/analyze-image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl })
      });

      const data = await response.json();
      if (data.success) {
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
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Description Generation function
  const generateDescriptionWithAI = async () => {
    if (!productForm.name || !productForm.category) return;
    
    setAiLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/ai/generate-description'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productForm.name,
          category: productForm.category,
          image_analysis: aiAnalysis,
          additional_info: []
        })
      });

      const data = await response.json();
      if (data.success && !productForm.description) {
        setProductForm(prev => ({
          ...prev,
          description: data.description
        }));
      }
    } catch (error) {
      console.error('AI description generation error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const removeImage = (url: string) => {
    setProductForm((prev: any) => ({ ...prev, image_urls: (prev.image_urls || []).filter((u: string) => u !== url) }));
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
          image_urls: productForm.image_urls
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
        setShowAddProductModal(false);
        
        // Refresh products list
        const token = localStorage.getItem('token');
        const res = await fetch(getApiUrl('/api/vendor/products'), { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
        
        alert('Product submitted successfully! It will be reviewed by admin before going live.');
      } else {
        const error = await response.json();
        alert('Failed to submit product: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-primary">Vendor Dashboard</h1>
                <p className="text-gray-600 mt-2">Welcome back, {user?.name}!</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-white rounded-lg shadow-md px-4 py-2 border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Notifications:</span>
                    <NotificationsMenu />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Products</p>
                    <p className="text-2xl font-bold text-primary">{stats?.totalProducts || 'Loading...'}</p>
                  </div>
                  <Package className="h-8 w-8 text-accent" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold text-primary">{stats?.totalOrders || 'Loading...'}</p>
                  </div>
                  <Users className="h-8 w-8 text-accent" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">KSH {stats?.totalRevenue || 'Loading...'}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-accent" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending Orders</p>
                    <p className="text-2xl font-bold text-primary">{stats?.pendingOrders || 'Loading...'}</p>
                  </div>
                  <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-800 font-bold">{stats?.pendingOrders || 'Loading...'}</span>
                  </div>
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
                  { id: 'products', label: 'My Products' },
                  { id: 'orders', label: 'Orders' },
                  { id: 'analytics', label: 'Analytics' },
                  { id: 'ai-assistant', label: 'AI Assistant' }
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
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-primary">Recent Activity</h2>
                    <Button 
                      className="btn-primary flex items-center"
                      onClick={() => setShowAddProductModal(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Product
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Latest Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
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

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Top Products</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {products.slice(0, 3).map(product => (
                            <div key={product.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <div>
                                <p className="font-medium text-sm">{product.name}</p>
                                <p className="text-xs text-gray-500">{product.orders} orders</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-sm">KSH {product.price}</p>
                                <Badge className={`text-xs ${getStatusColor(product.status)}`}>
                                  {product.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
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
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-primary">My Products</h2>
                    <Button 
                      className="btn-primary flex items-center"
                      onClick={() => setShowAddProductModal(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Product
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Price</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Stock</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Orders</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(product => (
                          <tr key={product.id} className="border-b border-gray-100">
                            <td className="py-3 px-4">{product.name}</td>
                            <td className="py-3 px-4">KSH {product.price}</td>
                            <td className="py-3 px-4">{product.stock}</td>
                            <td className="py-3 px-4">
                              <Badge className={getStatusColor(product.status)}>
                                {product.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{product.orders}</td>
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
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => editProduct(product)}
                                  title="Edit product"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => deleteProduct(product.id)}
                                  title="Delete product"
                                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
                  <h2 className="text-xl font-semibold text-primary">Order Management</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Order ID</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Quantity</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Total</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => (
                          <tr key={order.id} className="border-b border-gray-100">
                            <td className="py-3 px-4">#{order.id}</td>
                            <td className="py-3 px-4">{order.customer}</td>
                            <td className="py-3 px-4">{order.product}</td>
                            <td className="py-3 px-4">{order.quantity}</td>
                            <td className="py-3 px-4">KSH {order.total}</td>
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

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <VendorAnalytics />
              )}

              {/* AI Assistant Tab */}
              {activeTab === 'ai-assistant' && (
                <div className="space-y-6">
                  <AIProductAssistant 
                    onImageAnalysis={(analysis) => {
                      console.log('Image analysis:', analysis);
                    }}
                    onDescriptionGenerated={(description) => {
                      console.log('Generated description:', description);
                    }}
                    onContentModerated={(moderation) => {
                      console.log('Content moderation:', moderation);
                    }}
                    onSuggestionsGenerated={(suggestions) => {
                      console.log('Product suggestions:', suggestions);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-primary">Add New Product</h2>
                <button 
                  onClick={() => setShowAddProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* AI Assistant Section */}
              {aiAnalysis && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Images</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <div className="space-y-2">
                        <div className="mx-auto h-12 w-12 text-gray-400">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">
                          {uploading ? 'Uploading...' : 'Click to upload images or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                      </div>
                    </label>
                  </div>
                  
                  {/* Upload Error Display */}
                  {uploadError && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      {uploadError}
                    </div>
                  )}

                  {/* Image Preview */}
                  {productForm.image_urls && productForm.image_urls.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Uploaded Images:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {productForm.image_urls.map((url: string, index: number) => (
                          <div key={index} className="relative group">
                            <img
                              src={url.replace(/\\/g, '/')}
                              alt={`Product ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragEnter={() => handleDragEnterThumb(index)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => e.preventDefault()}
                              onError={(e) => {
                                console.log('Image failed to load:', url);
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
                    onClick={() => setShowAddProductModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary"
                  >
                    {submitting ? 'Submitting...' : 'Submit Product'}
                  </Button>
                </div>
              </form>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          {uploading ? 'Uploading...' : 'Click to upload images or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                      </div>
                    </label>
                  </div>

                  {/* Upload Error Display */}
                  {uploadError && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      {uploadError}
                    </div>
                  )}

                  {/* Image Preview */}
                  {productForm.image_urls && productForm.image_urls.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Current Images:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {productForm.image_urls.map((url: string, index: number) => (
                          <div key={index} className="relative group">
                            <img
                              src={url.replace(/\\/g, '/')}
                              alt={`Product ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragEnter={() => handleDragEnterThumb(index)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => e.preventDefault()}
                              onError={(e) => {
                                console.log('Image failed to load:', url);
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      <Footer />
    </div>
  );
};

export default VendorDashboard;

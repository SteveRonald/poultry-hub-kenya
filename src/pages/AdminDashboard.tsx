
import React, { useState } from 'react';
import { Users, Package, ShoppingCart, TrendingUp, Check, X, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data - replace with real API calls
  const stats = {
    totalVendors: 45,
    pendingVendors: 5,
    totalProducts: 234,
    pendingProducts: 12,
    totalOrders: 1250,
    totalRevenue: 2500000
  };

  const pendingVendors = [
    {
      id: 1,
      name: "John Kamau",
      farmName: "Sunrise Poultry Farm",
      location: "Nakuru",
      email: "john@sunrise.com",
      phone: "+254701234567",
      registrationDate: "2024-01-15"
    },
    {
      id: 2,
      name: "Mary Wanjiku",
      farmName: "Green Valley Layers",
      location: "Kiambu",
      email: "mary@greenvalley.com",
      phone: "+254709876543",
      registrationDate: "2024-01-14"
    }
  ];

  const pendingProducts = [
    {
      id: 1,
      name: "Premium Layer Chicks",
      vendor: "Sunrise Poultry Farm",
      price: 180,
      category: "chicks",
      submissionDate: "2024-01-15"
    },
    {
      id: 2,
      name: "Organic Farm Eggs",
      vendor: "Green Valley Layers",
      price: 500,
      category: "eggs",
      submissionDate: "2024-01-14"
    }
  ];

  const recentOrders = [
    {
      id: 1,
      customer: "Sarah Wilson",
      vendor: "Sunny Farm",
      product: "Day-Old Chicks",
      amount: 4000,
      status: "completed",
      date: "2024-01-15"
    },
    {
      id: 2,
      customer: "Peter Mwangi",
      vendor: "Fresh Poultry Co",
      product: "Whole Chicken",
      amount: 1600,
      status: "pending",
      date: "2024-01-15"
    }
  ];

  const handleApproveVendor = (vendorId: number) => {
    console.log('Approving vendor:', vendorId);
    // Implement approval logic
  };

  const handleRejectVendor = (vendorId: number) => {
    console.log('Rejecting vendor:', vendorId);
    // Implement rejection logic
  };

  const handleApproveProduct = (productId: number) => {
    console.log('Approving product:', productId);
    // Implement approval logic
  };

  const handleRejectProduct = (productId: number) => {
    console.log('Rejecting product:', productId);
    // Implement rejection logic
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back, {user?.name}! Manage your marketplace.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <Users className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Vendors</p>
                  <p className="text-xl font-bold text-primary">{stats.totalVendors}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="h-6 w-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-xs text-yellow-800 font-bold">{stats.pendingVendors}</span>
                  </div>
                  <p className="text-sm text-gray-600">Pending Vendors</p>
                  <p className="text-xl font-bold text-primary">{stats.pendingVendors}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <Package className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-xl font-bold text-primary">{stats.totalProducts}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="h-6 w-6 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-xs text-yellow-800 font-bold">{stats.pendingProducts}</span>
                  </div>
                  <p className="text-sm text-gray-600">Pending Products</p>
                  <p className="text-xl font-bold text-primary">{stats.pendingProducts}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <ShoppingCart className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-xl font-bold text-primary">{stats.totalOrders}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <TrendingUp className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-lg font-bold text-primary">KSH {(stats.totalRevenue / 1000000).toFixed(1)}M</p>
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
                    {(tab.id === 'vendors' && stats.pendingVendors > 0) && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        {stats.pendingVendors}
                      </span>
                    )}
                    {(tab.id === 'products' && stats.pendingProducts > 0) && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        {stats.pendingProducts}
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
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recent Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {recentOrders.map(order => (
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
                              {stats.pendingVendors} pending
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Product Listings</span>
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                              {stats.pendingProducts} pending
                            </span>
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
                    {pendingVendors.map(vendor => (
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
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleApproveVendor(vendor.id)}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleRejectVendor(vendor.id)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
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
                        {pendingProducts.map(product => (
                          <tr key={product.id} className="border-b border-gray-100">
                            <td className="py-3 px-4 font-medium">{product.name}</td>
                            <td className="py-3 px-4">{product.vendor}</td>
                            <td className="py-3 px-4 capitalize">{product.category}</td>
                            <td className="py-3 px-4">KSH {product.price}</td>
                            <td className="py-3 px-4">{product.submissionDate}</td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleApproveProduct(product.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleRejectProduct(product.id)}
                                >
                                  <X className="h-4 w-4" />
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
                        {recentOrders.map(order => (
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
      </div>

      <Footer />
    </div>
  );
};

export default AdminDashboard;

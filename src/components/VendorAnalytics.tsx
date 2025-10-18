import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Package, 
  Store,
  Calendar,
  Download,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { getApiUrl } from '../config/api';
import { exportToPDF } from '../utils/pdfExport';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface VendorAnalyticsData {
  overview: {
    total_revenue: number;
    total_orders: number;
    total_products: number;
    active_products: number;
    unique_customers: number;
    average_order_value: number;
  };
  sales: {
    daily_trend: Array<{ date: string; daily_revenue: number; daily_orders: number }>;
    by_payment_method: Array<{ payment_method: string; revenue: number; order_count: number }>;
  };
  products: {
    top_selling: Array<{ product_name: string; category: string; total_quantity: number; total_revenue: number; order_count: number; avg_order_value: number }>;
    by_category: Array<{ category: string; product_count: number; category_revenue: number; total_quantity: number }>;
    stock_levels: Array<{ name: string; stock_quantity: number; price: number; is_active: boolean }>;
  };
  customers: {
    top_customers: Array<{ customer_name: string; customer_email: string; order_count: number; total_spent: number; last_order_date: string }>;
    repeat_customers: number;
    new_customers: number;
    returning_customers: number;
  };
  orders: {
    status_distribution: Array<{ status: string; count: number; total_amount: number }>;
    avg_processing_time_hours: number;
  };
}

const VendorAnalytics: React.FC = () => {
  const [data, setData] = useState<VendorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('period', period);
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);

      const response = await fetch(getApiUrl(`/api/vendor/analytics?${params}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      } else {
        console.error('Failed to fetch vendor analytics');
      }
    } catch (error) {
      console.error('Error fetching vendor analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, dateRange]);

  const handleExport = async () => {
    if (!data) return;
    
    setExporting(true);
    try {
      const result = await exportToPDF({
        title: 'Vendor Analytics Report',
        subtitle: `${user?.vendorData?.farm_name || 'Your Farm'} Performance Report`,
        data,
        dateRange: dateRange.start && dateRange.end ? {
          startDate: dateRange.start,
          endDate: dateRange.end
        } : undefined,
        exportedBy: user?.name || user?.email || 'Vendor',
        userRole: 'vendor'
      });
      
      if (result.success) {
        toast.success('Analytics report has been exported successfully!');
      } else {
        toast.error(result.error || 'Failed to export PDF. Please try again.');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const COLORS = ['#2c5530', '#4a7c59', '#6ba86b', '#8bc34a', '#a5d6a7'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'confirmed': return '#3b82f6';
      case 'processing': return '#8b5cf6';
      case 'shipped': return '#6366f1';
      case 'delivered': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load analytics data</p>
        <Button onClick={fetchAnalytics} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-primary">Vendor Analytics</h2>
          <p className="text-gray-600">Your business performance and insights</p>
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="flex flex-col space-y-1">
              <label htmlFor="start-date" className="text-sm font-medium text-gray-700">Start Date</label>
              <input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-auto"
                aria-label="Select start date for analytics"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label htmlFor="end-date" className="text-sm font-medium text-gray-700">End Date</label>
              <input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-auto"
                aria-label="Select end date for analytics"
              />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="flex flex-wrap gap-2">
              {['7', '30', '90', '365'].map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p)}
                  className="flex-1 sm:flex-none"
                >
                  {p}D
                </Button>
              ))}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full sm:w-auto"
              onClick={handleExport}
              disabled={!data || exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-primary">KSH {data.overview.total_revenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-primary">{data.overview.total_orders.toLocaleString()}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Customers</p>
                <p className="text-2xl font-bold text-primary">{data.overview.unique_customers.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-primary">{data.overview.total_products.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Products</p>
                <p className="text-2xl font-bold text-primary">{data.overview.active_products.toLocaleString()}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-primary">KSH {data.overview.average_order_value.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.sales.daily_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => [
                  name === 'daily_revenue' ? `KSH ${value.toLocaleString()}` : value,
                  name === 'daily_revenue' ? 'Revenue' : 'Orders'
                ]} />
                <Area yAxisId="left" type="monotone" dataKey="daily_revenue" stroke="#2c5530" fill="#2c5530" fillOpacity={0.3} />
                <Line yAxisId="right" type="monotone" dataKey="daily_orders" stroke="#4a7c59" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.orders.status_distribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.orders.status_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.sales.by_payment_method}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="payment_method" />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  name === 'revenue' ? `KSH ${value.toLocaleString()}` : value,
                  name === 'revenue' ? 'Revenue' : 'Orders'
                ]} />
                <Bar dataKey="revenue" fill="#2c5530" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customer Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">New Customers</p>
                  <p className="text-2xl font-bold text-green-600">{data.customers.new_customers}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
              
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Returning Customers</p>
                  <p className="text-2xl font-bold text-blue-600">{data.customers.returning_customers}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Repeat Customers</p>
                  <p className="text-2xl font-bold text-purple-600">{data.customers.repeat_customers}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Selling Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-right py-2">Quantity Sold</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Avg Order Value</th>
                </tr>
              </thead>
              <tbody>
                {data.products.top_selling.map((product, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 font-medium">{product.product_name}</td>
                    <td className="py-2 text-gray-600">{product.category}</td>
                    <td className="py-2 text-right">{product.total_quantity}</td>
                    <td className="py-2 text-right">{product.order_count}</td>
                    <td className="py-2 text-right font-medium">KSH {product.total_revenue.toLocaleString()}</td>
                    <td className="py-2 text-right">KSH {product.avg_order_value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Customer</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Total Spent</th>
                  <th className="text-right py-2">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.top_customers.map((customer, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 font-medium">{customer.customer_name}</td>
                    <td className="py-2 text-gray-600">{customer.customer_email}</td>
                    <td className="py-2 text-right">{customer.order_count}</td>
                    <td className="py-2 text-right font-medium">KSH {customer.total_spent.toLocaleString()}</td>
                    <td className="py-2 text-right text-sm text-gray-500">
                      {new Date(customer.last_order_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stock Levels Alert */}
      {data.products.stock_levels.some(product => product.stock_quantity < 10) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.products.stock_levels
                .filter(product => product.stock_quantity < 10)
                .map((product, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="destructive">
                      {product.stock_quantity} left
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Processing Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {data.orders.avg_processing_time_hours.toFixed(1)}h
              </p>
              <p className="text-gray-600">Average Processing Time</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Performance by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.products.by_category.map((category, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{category.category}</p>
                    <p className="text-sm text-gray-600">{category.product_count} products</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">KSH {category.category_revenue.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">{category.total_quantity} sold</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorAnalytics;


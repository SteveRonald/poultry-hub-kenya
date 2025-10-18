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
  Download
} from 'lucide-react';
import { getApiUrl } from '../config/api';
import { exportToPDF } from '../utils/pdfExport';
import { useAuth } from '../contexts/AuthContext';
import { useAdmin } from '../contexts/AdminContext';
import { toast } from 'sonner';

interface AnalyticsData {
  overview: {
    total_revenue: number;
    total_orders: number;
    total_customers: number;
    total_vendors: number;
    total_products: number;
    average_order_value: number;
  };
  revenue: {
    daily_trend: Array<{ date: string; daily_revenue: number }>;
    by_payment_method: Array<{ payment_method: string; revenue: number }>;
  };
  orders: {
    daily_trend: Array<{ date: string; daily_orders: number }>;
    status_distribution: Array<{ status: string; count: number }>;
  };
  users: {
    customer_registrations: Array<{ date: string; daily_registrations: number }>;
    vendor_registrations: Array<{ date: string; daily_registrations: number }>;
    active_customers: number;
  };
  products: {
    top_selling: Array<{ product_name: string; total_quantity: number; total_revenue: number; order_count: number }>;
    by_category: Array<{ category: string; product_count: number; category_revenue: number }>;
  };
  vendors: {
    top_performing: Array<{ vendor_name: string; farm_name: string; total_orders: number; total_revenue: number; avg_order_value: number }>;
    status_distribution: Array<{ status: string; count: number }>;
  };
}

const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const { admin } = useAdmin();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const params = new URLSearchParams();
      params.append('period', period);
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);

      const response = await fetch(getApiUrl(`/api/admin/analytics?${params}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      } else {
        console.error('Failed to fetch analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
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
        title: 'Admin Analytics Report',
        subtitle: 'Comprehensive platform analytics and insights',
        data,
        dateRange: dateRange.start && dateRange.end ? {
          startDate: dateRange.start,
          endDate: dateRange.end
        } : undefined,
        exportedBy: admin?.full_name || user?.name || 'Admin',
        userRole: 'admin'
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
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
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
          <h2 className="text-2xl font-bold text-primary">Analytics Dashboard</h2>
          <p className="text-gray-600">System-wide performance metrics and insights</p>
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="flex flex-col">
                <label htmlFor="start-date" className="text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  aria-label="Start Date"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="end-date" className="text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  aria-label="End Date"
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
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
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-primary">{data.overview.total_customers.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Vendors</p>
                <p className="text-2xl font-bold text-primary">{data.overview.total_vendors.toLocaleString()}</p>
              </div>
              <Store className="h-8 w-8 text-orange-600" />
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
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.revenue.daily_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`KSH ${value.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="daily_revenue" stroke="#2c5530" fill="#2c5530" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Order Volume Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.orders.daily_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="daily_orders" stroke="#4a7c59" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Revenue by Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.revenue.by_payment_method}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="payment_method" />
                <YAxis />
                <Tooltip formatter={(value) => [`KSH ${value.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#2c5530" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Vendors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">Farm Name</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Avg Order Value</th>
                </tr>
              </thead>
              <tbody>
                {data.vendors.top_performing.map((vendor, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 font-medium">{vendor.vendor_name}</td>
                    <td className="py-2 text-gray-600">{vendor.farm_name}</td>
                    <td className="py-2 text-right">{vendor.total_orders}</td>
                    <td className="py-2 text-right font-medium">KSH {vendor.total_revenue.toLocaleString()}</td>
                    <td className="py-2 text-right">KSH {vendor.avg_order_value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                  <th className="text-right py-2">Quantity Sold</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.products.top_selling.map((product, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 font-medium">{product.product_name}</td>
                    <td className="py-2 text-right">{product.total_quantity}</td>
                    <td className="py-2 text-right">{product.order_count}</td>
                    <td className="py-2 text-right font-medium">KSH {product.total_revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;

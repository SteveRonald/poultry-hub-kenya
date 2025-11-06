import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import CreateAdvertisementForm from './CreateAdvertisementForm';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Plus, 
  Eye, 
  MousePointerClick, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Edit,
  Trash2
} from 'lucide-react';
import { getApiUrl, getImageUrl } from '../config/api';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface Advertisement {
  id: string;
  product_id: string;
  product_name: string;
  product_images?: string | string[];
  tier: 'basic' | 'premium';
  price: number;
  duration_days: number;
  status: 'pending' | 'approved' | 'active' | 'expired' | 'rejected';
  ad_image: string;
  ad_title: string;
  ad_description?: string;
  previous_price?: number | null;
  current_price?: number | null;
  views_count: number;
  clicks_count: number;
  revenue_generated: number;
  orders_count: number;
  created_at: string;
  start_date?: string;
  end_date?: string;
}

const AdvertisementManager: React.FC = () => {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [editFormData, setEditFormData] = useState({
    ad_title: '',
    ad_description: '',
    ad_image: '',
    previous_price: '',
    current_price: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeAdTab, setActiveAdTab] = useState<'active' | 'inactive'>('active');

  useEffect(() => {
    fetchAdvertisements();
  }, [refreshKey]);

  const fetchAdvertisements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/vendor/advertisements'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setAdvertisements(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load advertisements');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (adId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        getApiUrl(`/api/vendor/advertisements/analytics?ad_id=${adId}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      toast.error('Failed to load analytics');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>,
      approved: <Badge className="bg-blue-100 text-blue-800">Approved</Badge>,
      active: <Badge className="bg-green-100 text-green-800">Active</Badge>,
      expired: <Badge className="bg-gray-100 text-gray-800">Expired</Badge>,
      rejected: <Badge className="bg-red-100 text-red-800">Rejected</Badge>
    };
    return badges[status as keyof typeof badges] || <Badge>{status}</Badge>;
  };

  const calculateCTR = (views: number, clicks: number) => {
    return views > 0 ? ((clicks / views) * 100).toFixed(2) : '0.00';
  };

  const isAdExpired = (ad: Advertisement) => {
    if (ad.status === 'expired') return true;
    if (ad.end_date) {
      const endDate = new Date(ad.end_date);
      const now = new Date();
      return endDate < now;
    }
    return false;
  };

  const handleEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setEditFormData({
      ad_title: ad.ad_title || '',
      ad_description: ad.ad_description || '',
      ad_image: ad.ad_image || '',
      previous_price: (ad as any).previous_price?.toString() || '',
      current_price: (ad as any).current_price?.toString() || ''
    });
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('token');
    const response = await fetch(getApiUrl('/api/upload'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.url || data.image_url || '';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please select an image or video file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      const imageUrl = await uploadImage(file);
      setEditFormData({ ...editFormData, ad_image: imageUrl });
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateAd = async () => {
    if (!editingAd) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/vendor/advertisements'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          advertisement_id: editingAd.id,
          ad_title: editFormData.ad_title,
          ad_description: editFormData.ad_description,
          ad_image: editFormData.ad_image,
          previous_price: editFormData.previous_price ? parseFloat(editFormData.previous_price) : null,
          current_price: editFormData.current_price ? parseFloat(editFormData.current_price) : null
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Advertisement updated successfully');
        setEditingAd(null);
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(data.error || 'Failed to update advertisement');
      }
    } catch (error) {
      toast.error('Failed to update advertisement');
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<Advertisement | null>(null);

  const handleDeleteAd = async () => {
    if (!deleteConfirm) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/vendor/advertisements'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          advertisement_id: deleteConfirm.id
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Advertisement deleted successfully');
        setDeleteConfirm(null);
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(data.error || 'Failed to delete advertisement');
      }
    } catch (error) {
      toast.error('Failed to delete advertisement');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading advertisements...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primary">My Advertisements</h2>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Advertisement
        </Button>
      </div>

      {/* Total Revenue Summary */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center">
            <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-1">Total Revenue Generated from Ads</p>
            <p className="text-3xl font-bold text-green-600">
              KSh {(() => {
                const total = advertisements.reduce((sum, ad) => sum + (parseFloat(ad.revenue_generated) || 0), 0);
                return total.toLocaleString('en-US', { 
                  minimumFractionDigits: total > 0 ? 2 : 0, 
                  maximumFractionDigits: 2 
                });
              })()}
            </p>
            <p className="text-xs text-gray-500 mt-1">From all advertisements</p>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-orange-600">
                  KSh {advertisements.reduce((sum, ad) => sum + (parseFloat(ad.price) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold">
                  {advertisements.reduce((sum, ad) => sum + (ad.views_count || 0), 0)}
                </p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Clicks</p>
                <p className="text-2xl font-bold">
                  {advertisements.reduce((sum, ad) => sum + (ad.clicks_count || 0), 0)}
                </p>
              </div>
              <MousePointerClick className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Ads</p>
                <p className="text-2xl font-bold">
                  {advertisements.filter(ad => ad.status === 'active').length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation for Active/Inactive Ads */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveAdTab('active')}
            className={`relative py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeAdTab === 'active'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Active Ads ({advertisements.filter(ad => ad.status === 'active').length})
            {activeAdTab === 'active' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
            )}
          </button>
          <button
            onClick={() => setActiveAdTab('inactive')}
            className={`relative py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeAdTab === 'inactive'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Inactive Ads ({advertisements.filter(ad => ad.status !== 'active').length})
            {activeAdTab === 'inactive' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
            )}
          </button>
        </nav>
      </div>

      {/* Advertisements List */}
      {(() => {
        const filteredAds = advertisements.filter(ad => 
          activeAdTab === 'active' ? ad.status === 'active' : ad.status !== 'active'
        );
        
        if (filteredAds.length === 0) {
          return (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 text-lg">
                  {activeAdTab === 'active' 
                    ? 'No active advertisements. Create one to get started!' 
                    : 'No inactive advertisements.'}
                </p>
              </CardContent>
            </Card>
          );
        }
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAds.map((ad) => {
          // Get image/video URL - same logic as AdvertisementBanner
          const productImage = ad.ad_image || 
            (ad.product_images ? (typeof ad.product_images === 'string' ? JSON.parse(ad.product_images)[0] : ad.product_images[0]) : null) ||
            '/placeholder.svg';
          
          // Determine if it's a video
          const isVideo = productImage?.endsWith('.mp4') || 
                         productImage?.endsWith('.webm') || 
                         productImage?.endsWith('.mov') ||
                         productImage?.includes('video');
          
          // Use getImageUrl to handle URL conversion (localhost to network, etc.)
          const imageUrl = productImage && productImage !== '/placeholder.svg' ? getImageUrl(productImage) : productImage;
          
          return (
          <Card key={ad.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{ad.ad_title || ad.product_name}</CardTitle>
                {getStatusBadge(ad.status)}
              </div>
              <Badge variant={ad.tier === 'premium' ? 'default' : 'secondary'}>
                {ad.tier.toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Ad Image/Video Preview - Always show */}
                <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 mb-3 border border-gray-200">
                  {productImage && productImage !== '/placeholder.svg' ? (
                    isVideo ? (
                      <video
                        src={imageUrl}
                        className="w-full h-full object-cover"
                        controls
                        muted
                        preload="metadata"
                        onError={(e) => {
                          console.error('Video load error:', imageUrl, 'Original:', productImage);
                          e.currentTarget.style.display = 'none';
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <img
                        src={imageUrl}
                        alt={ad.ad_title || ad.product_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Image load error:', imageUrl, 'Original:', productImage);
                          // Fallback to placeholder if image fails to load
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                        onLoad={() => {
                          if (import.meta.env.DEV) {
                            console.log('Image loaded successfully:', imageUrl);
                          }
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                      <p className="text-sm">No image/video</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Product</p>
                  <p className="font-medium">{ad.product_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-600">Price</p>
                    <p className="font-semibold">KSh {ad.price.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Duration</p>
                    <p className="font-semibold">{ad.duration_days} days</p>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Views:</span>
                    <span className="font-medium">{ad.views_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Clicks:</span>
                    <span className="font-medium">{ad.clicks_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">CTR:</span>
                    <span className="font-medium">{calculateCTR(ad.views_count || 0, ad.clicks_count || 0)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Revenue Generated:</span>
                    <span className="font-semibold text-green-600 text-base">
                      KSh {(() => {
                        const revenue = parseFloat(ad.revenue_generated || 0);
                        return revenue.toLocaleString('en-US', { 
                          minimumFractionDigits: revenue > 0 ? 2 : 0, 
                          maximumFractionDigits: 2 
                        });
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Orders:</span>
                    <span className="font-medium">{ad.orders_count || 0}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedAd(ad);
                      fetchAnalytics(ad.id);
                    }}
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Analytics
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(ad)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {isAdExpired(ad) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteConfirm(ad)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
          </div>
        );
      })()}

      {/* Create Advertisement Form Modal */}
      <Dialog open={showCreateForm} onOpenChange={(open) => setShowCreateForm(open)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <CreateAdvertisementForm
            onSuccess={() => {
              setShowCreateForm(false);
              setRefreshKey(prev => prev + 1);
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {advertisements.length === 0 && !showCreateForm && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No advertisements yet</p>
            <Button onClick={() => setShowCreateForm(true)} className="mt-4">
              Create Your First Advertisement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingAd} onOpenChange={(open) => !open && setEditingAd(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Advertisement</DialogTitle>
            <DialogDescription>
              Update your advertisement details. Note: Price and duration cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit_ad_title">Advertisement Title</Label>
              <Input
                id="edit_ad_title"
                value={editFormData.ad_title}
                onChange={(e) => setEditFormData({ ...editFormData, ad_title: e.target.value })}
                placeholder="Enter a catchy title for your ad"
              />
            </div>
            <div>
              <Label htmlFor="edit_ad_description">Advertisement Description</Label>
              <Textarea
                id="edit_ad_description"
                value={editFormData.ad_description}
                onChange={(e) => setEditFormData({ ...editFormData, ad_description: e.target.value })}
                placeholder="Describe your product or promotion"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_previous_price">Previous Price (Optional)</Label>
                <Input
                  id="edit_previous_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormData.previous_price}
                  onChange={(e) => setEditFormData({ ...editFormData, previous_price: e.target.value })}
                  placeholder="e.g., 5000"
                />
              </div>
              <div>
                <Label htmlFor="edit_current_price">Current/Discounted Price (Optional)</Label>
                <Input
                  id="edit_current_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormData.current_price}
                  onChange={(e) => setEditFormData({ ...editFormData, current_price: e.target.value })}
                  placeholder="e.g., 3500"
                />
              </div>
            </div>
            <div>
              <Label>Advertisement Image/Video</Label>
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="mt-2"
                disabled={uploadingImage}
              />
              {editFormData.ad_image && (
                <div className="mt-2">
                  <img
                    src={getImageUrl(editFormData.ad_image)}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                </div>
              )}
              {uploadingImage && (
                <p className="text-sm text-gray-500 mt-2">Uploading...</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAd(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAd} disabled={uploadingImage}>
              Update Advertisement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Advertisement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this advertisement? This action cannot be undone.
              Only expired advertisements can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAd}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Analytics Modal - Simplified for now, can be expanded */}
      {selectedAd && analytics && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Detailed Analytics: {selectedAd.ad_title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold">{analytics.views_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Clicks</p>
                <p className="text-2xl font-bold">{analytics.clicks_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">CTR</p>
                <p className="text-2xl font-bold">{analytics.ctr}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  KSh {parseFloat(analytics.revenue_generated || 0).toLocaleString('en-US', { 
                    minimumFractionDigits: analytics.revenue_generated > 0 ? 2 : 0, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
            </div>
            {analytics.orders && analytics.orders.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-2">Orders from this Ad:</h4>
                <div className="space-y-2">
                  {analytics.orders.map((order: any) => (
                    <div key={order.id} className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>{order.order_number}</span>
                      <span className="font-medium">KSh {order.total_amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSelectedAd(null);
                setAnalytics(null);
              }}
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdvertisementManager;


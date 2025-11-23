import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Calendar,
  DollarSign,
  BarChart3,
  AlertCircle,
  Edit,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { getApiUrl, getImageUrl } from '../config/api';
import { toast } from 'sonner';
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
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface Advertisement {
  id: string;
  vendor_id: string;
  product_id: string;
  product_name: string;
  product_images?: string | string[];
  vendor_name: string;
  tier: 'basic' | 'premium';
  price: number;
  duration_days: number;
  status: 'pending' | 'approved' | 'active' | 'expired' | 'rejected';
  ad_image: string;
  ad_title: string;
  ad_description: string;
  content_duration?: number | null;
  created_at: string;
  start_date?: string | null;
  end_date?: string | null;
  activated_at?: string | null;
  views_count: number;
  clicks_count: number;
  revenue_generated: number;
  rejection_reason?: string | null;
  priority?: number;
  previous_price?: number | null;
  current_price?: number | null;
}

const AdminAdvertisementManager: React.FC = () => {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPages, setSelectedPages] = useState<string[]>(['homepage', 'products']);
  const [processing, setProcessing] = useState<string | null>(null);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [editFormData, setEditFormData] = useState({
    ad_title: '',
    ad_description: '',
    ad_image: '',
    previous_price: '',
    current_price: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Advertisement | null>(null);
  const [reactivatingAd, setReactivatingAd] = useState<Advertisement | null>(null);
  const [reactivateFormData, setReactivateFormData] = useState({
    tier: 'basic' as 'basic' | 'premium',
    duration_days: 7,
    ad_title: '',
    ad_description: '',
    ad_image: '',
    previous_price: '',
    current_price: '',
    content_duration: 15,
    page_locations: ['homepage', 'products'] as string[],
    activate_immediately: true
  });
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    fetchAdvertisements();
  }, [filter]);

  const fetchAdvertisements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_session_token');
      if (!token) {
        toast.error('Please log in to view advertisements');
        setLoading(false);
        return;
      }
      
      const url = filter === 'all' 
        ? '/api/admin/advertisements'
        : `/api/admin/advertisements?status=${filter}`;
      
      const response = await fetch(getApiUrl(url), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || 'Failed to load advertisements');
        setAdvertisements([]);
        return;
      }
      
      setAdvertisements(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching advertisements:', error);
      toast.error('Failed to load advertisements. Please check your connection.');
      setAdvertisements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedAd) return;
    
    if (selectedPages.length === 0) {
      toast.error('Please select at least one page where the ad should appear');
      return;
    }

    setProcessing(selectedAd.id);
    try {
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/admin/advertisements/approve'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          advertisement_id: selectedAd.id,
          page_locations: selectedPages
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Advertisement approved and activated');
        setShowApproveDialog(false);
        setSelectedAd(null);
        setSelectedPages(['homepage', 'products']); // Reset to default
        fetchAdvertisements();
      } else {
        toast.error(data.error || 'Failed to approve advertisement');
      }
    } catch (error) {
      toast.error('Failed to approve advertisement');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedAd || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(selectedAd.id);
    try {
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/admin/advertisements/reject'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          advertisement_id: selectedAd.id,
          rejection_reason: rejectionReason
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Advertisement rejected');
        setShowRejectDialog(false);
        setRejectionReason('');
        setSelectedAd(null);
        fetchAdvertisements();
      } else {
        toast.error(data.error || 'Failed to reject advertisement');
      }
    } catch (error) {
      toast.error('Failed to reject advertisement');
    } finally {
      setProcessing(null);
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

  const isAdExpired = (ad: Advertisement) => {
    if (ad.status === 'expired') return true;
    if (ad.end_date) {
      const endDate = new Date(ad.end_date);
      const now = new Date();
      return endDate < now;
    }
    return false;
  };

  const getDaysRemaining = (ad: Advertisement) => {
    if (!ad.end_date) return 'N/A';
    try {
      const end = new Date(ad.end_date).getTime();
      const now = Date.now();
      const diff = end - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (isNaN(days)) return 'N/A';
      if (days <= 0) return 'Expired';
      if (days === 1) return '1 day';
      return `${days} days`;
    } catch (e) {
      return 'N/A';
    }
  };

  const handleReactivateClick = (ad: Advertisement) => {
    setReactivatingAd(ad);
    // Initialize form with current ad values
    const pageLocations = (ad as any).page_locations || ['homepage', 'products'];
    setReactivateFormData({
      tier: ad.tier,
      duration_days: ad.duration_days,
      ad_title: ad.ad_title || '',
      ad_description: ad.ad_description || '',
      ad_image: ad.ad_image || '',
      previous_price: (ad as any).previous_price?.toString() || '',
      current_price: (ad as any).current_price?.toString() || '',
      content_duration: (ad as any).content_duration || (ad.tier === 'basic' ? 15 : 30),
      page_locations: Array.isArray(pageLocations) ? pageLocations : ['homepage', 'products'],
      activate_immediately: true
    });
  };

  const calculateReactivatePrice = () => {
    const tierPrice = reactivateFormData.tier === 'premium' ? 300 : 128;
    return tierPrice * reactivateFormData.duration_days;
  };

  const handleReactivate = async () => {
    if (!reactivatingAd) return;

    setReactivating(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/advertisements/reactivate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          advertisement_id: reactivatingAd.id,
          tier: reactivateFormData.tier,
          duration_days: reactivateFormData.duration_days,
          ad_title: reactivateFormData.ad_title,
          ad_description: reactivateFormData.ad_description,
          ad_image: reactivateFormData.ad_image,
          previous_price: reactivateFormData.previous_price ? parseFloat(reactivateFormData.previous_price) : null,
          current_price: reactivateFormData.current_price ? parseFloat(reactivateFormData.current_price) : null,
          content_duration: reactivateFormData.content_duration,
          page_locations: reactivateFormData.page_locations,
          activate_immediately: reactivateFormData.activate_immediately
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Advertisement reactivated successfully');
        setReactivatingAd(null);
        fetchAdvertisements();
      } else {
        toast.error(data.error || 'Failed to reactivate advertisement');
      }
    } catch (error) {
      toast.error('Failed to reactivate advertisement');
    } finally {
      setReactivating(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('admin_session_token');
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
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/admin/advertisements'), {
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
        fetchAdvertisements();
      } else {
        toast.error(data.error || 'Failed to update advertisement');
      }
    } catch (error) {
      toast.error('Failed to update advertisement');
    }
  };

  const handleDeleteAd = async () => {
    if (!deleteConfirm) return;

    try {
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/admin/advertisements'), {
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
        fetchAdvertisements();
      } else {
        toast.error(data.error || 'Failed to delete advertisement');
      }
    } catch (error) {
      toast.error('Failed to delete advertisement');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading advertisements...</p>
        </CardContent>
      </Card>
    );
  }

  const pendingAds = advertisements.filter(ad => ad.status === 'pending');
  const activeAds = advertisements.filter(ad => ad.status === 'active');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-primary">Advertisement Management</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
            className="flex-1 sm:flex-initial text-xs sm:text-sm whitespace-nowrap"
          >
            All ({advertisements.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
            size="sm"
            className="flex-1 sm:flex-initial text-xs sm:text-sm whitespace-nowrap"
          >
            Pending ({pendingAds.length})
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            onClick={() => setFilter('active')}
            size="sm"
            className="flex-1 sm:flex-initial text-xs sm:text-sm whitespace-nowrap"
          >
            Active ({activeAds.length})
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Ads</p>
                <p className="text-2xl font-bold">{advertisements.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingAds.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeAds.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
        <div>
                <p className="text-xs text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-primary">
                  KSh {advertisements.reduce((sum, ad) => sum + (Number(ad.price) || 0), 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advertisements List */}
      <div className="space-y-4">
        {advertisements.map((ad) => (
          <Card key={ad.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Ad Image/Video */}
                <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                  {(() => {
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
                    
                    if (productImage && productImage !== '/placeholder.svg') {
                      if (isVideo) {
                        return (
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
                        );
                      } else {
                        return (
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
                        );
                      }
                    } else {
                      return (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                          <p className="text-xs text-center">No image/video</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Ad Details */}
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold">{ad.ad_title || ad.product_name}</h3>
                      <p className="text-sm text-gray-600">Product: {ad.product_name}</p>
                      <p className="text-sm text-gray-600">Vendor: {ad.vendor_name}</p>
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(ad.status)}
                      <Badge variant={ad.tier === 'premium' ? 'default' : 'secondary'}>
                        {ad.tier.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {ad.ad_description && (
                    <p className="text-sm text-gray-700 mb-4">{ad.ad_description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600">Price</p>
                      <p className="font-semibold">KSh {(Number(ad.price) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Duration</p>
                      <p className="font-semibold">{ad.duration_days} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Days Remaining</p>
                      <p className="font-semibold">{getDaysRemaining(ad)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Created</p>
                      <p className="font-semibold text-xs">
                        {new Date(ad.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {ad.status === 'active' && (
                    <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-green-50 rounded">
                      <div>
                        <p className="text-xs text-gray-600">Views</p>
                        <p className="font-semibold">{ad.views_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Clicks</p>
                        <p className="font-semibold">{ad.clicks_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Revenue</p>
                          <p className="font-semibold text-green-600">
                            KSh {(Number((ad as any).revenue_generated) || 0).toLocaleString()}
                          </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {ad.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedAd(ad);
                          setShowApproveDialog(true);
                        }}
                        disabled={processing === ad.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {processing === ad.id ? 'Approving...' : 'Approve & Activate'}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setSelectedAd(ad);
                          setShowRejectDialog(true);
                        }}
                        disabled={processing === ad.id}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {ad.status === 'active' && ad.end_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>Expires: {new Date(ad.end_date).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Edit and Delete buttons */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingAd(ad);
                        setEditFormData({
                          ad_title: ad.ad_title || '',
                          ad_description: ad.ad_description || '',
                          ad_image: ad.ad_image || '',
                          previous_price: (ad as any).previous_price?.toString() || '',
                          current_price: (ad as any).current_price?.toString() || ''
                        });
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {(() => {
                      const isExpired = ad.status === 'expired' || 
                        (ad.end_date && new Date(ad.end_date) < new Date());
                      return isExpired && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleReactivateClick(ad)}
                            title="Reactivate Advertisement"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reactivate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteConfirm(ad)}
                            title="Delete Advertisement"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {advertisements.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">
              {filter === 'pending' 
                ? 'No pending advertisements' 
                : filter === 'active'
                ? 'No active advertisements'
                : 'No advertisements found'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog with Page Selection */}
      <AlertDialog open={showApproveDialog} onOpenChange={(open) => {
        setShowApproveDialog(open);
        if (!open) {
          setSelectedPages(['homepage', 'products']);
          setSelectedAd(null);
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Advertisement</AlertDialogTitle>
            <AlertDialogDescription>
              Select which pages this advertisement should appear on. This helps balance ad distribution across the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-sm font-medium">Select Pages * (Multiple selections allowed)</Label>
            <p className="text-xs text-gray-500 mb-2">You can select multiple pages. The ad will appear on all selected pages (max 3 ads per page).</p>
            <div className="space-y-2">
              {[
                { value: 'homepage', label: 'Home Page' },
                { value: 'products', label: 'Products Page' },
                { value: 'blog', label: 'Blog Page' },
                { value: 'training', label: 'Training Page' }
              ].map((page) => (
                <label key={page.value} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedPages.includes(page.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPages([...selectedPages, page.value]);
                      } else {
                        setSelectedPages(selectedPages.filter(p => p !== page.value));
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{page.label}</span>
                </label>
              ))}
            </div>
            {selectedPages.length === 0 && (
              <p className="text-xs text-red-600 mt-2">Please select at least one page</p>
            )}
            {selectedPages.length > 0 && (
              <p className="text-xs text-green-600 mt-2">
                ✓ Selected: {selectedPages.map(p => {
                  const labels: Record<string, string> = {
                    'homepage': 'Home',
                    'products': 'Products',
                    'blog': 'Blog',
                    'training': 'Training'
                  };
                  return labels[p] || p;
                }).join(', ')}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedPages(['homepage', 'products']);
              setSelectedAd(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={selectedPages.length === 0 || processing === selectedAd?.id}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing === selectedAd?.id ? 'Approving...' : 'Approve & Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Advertisement</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this advertisement. The vendor will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection_reason">Rejection Reason *</Label>
            <Textarea
              id="rejection_reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={4}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRejectionReason('');
              setSelectedAd(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processing !== null}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? 'Rejecting...' : 'Reject Advertisement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAd} onOpenChange={(open) => !open && setEditingAd(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Advertisement</DialogTitle>
            <DialogDescription>
              Update advertisement details. Note: Price and duration cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="admin_edit_ad_title">Advertisement Title</Label>
              <Input
                id="admin_edit_ad_title"
                value={editFormData.ad_title}
                onChange={(e) => setEditFormData({ ...editFormData, ad_title: e.target.value })}
                placeholder="Enter a catchy title for your ad"
              />
            </div>
            <div>
              <Label htmlFor="admin_edit_ad_description">Advertisement Description</Label>
              <Textarea
                id="admin_edit_ad_description"
                value={editFormData.ad_description}
                onChange={(e) => setEditFormData({ ...editFormData, ad_description: e.target.value })}
                placeholder="Describe your product or promotion"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="admin_edit_previous_price">Previous Price (Optional)</Label>
                <Input
                  id="admin_edit_previous_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormData.previous_price}
                  onChange={(e) => setEditFormData({ ...editFormData, previous_price: e.target.value })}
                  placeholder="e.g., 5000"
                />
              </div>
              <div>
                <Label htmlFor="admin_edit_current_price">Current/Discounted Price (Optional)</Label>
                <Input
                  id="admin_edit_current_price"
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

      {/* Reactivate Advertisement Dialog */}
      <Dialog open={!!reactivatingAd} onOpenChange={(open) => !open && setReactivatingAd(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reactivate Advertisement</DialogTitle>
            <DialogDescription>
              Edit advertisement details and reactivate it. As admin, you can activate it immediately or set it to pending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Tier Selection */}
            <div>
              <Label htmlFor="reactivate_tier">Advertisement Tier *</Label>
              <Select
                value={reactivateFormData.tier}
                onValueChange={(value) => {
                  const newTier = value as 'basic' | 'premium';
                  setReactivateFormData({
                    ...reactivateFormData,
                    tier: newTier,
                    content_duration: newTier === 'basic' ? 15 : 30
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    Basic - KSh 128/day
                    <span className="text-xs text-gray-500 ml-2">(15-30 seconds)</span>
                  </SelectItem>
                  <SelectItem value="premium">
                    Premium - KSh 300/day
                    <span className="text-xs text-gray-500 ml-2">(up to 60 seconds)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div>
              <Label htmlFor="reactivate_duration_days">Duration (Days) *</Label>
              <Input
                id="reactivate_duration_days"
                type="number"
                min="1"
                value={reactivateFormData.duration_days}
                onChange={(e) => {
                  const days = parseInt(e.target.value) || 1;
                  setReactivateFormData({ ...reactivateFormData, duration_days: days });
                }}
              />
            </div>

            {/* Calculated Price Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">New Price:</span>
                <span className="text-2xl font-bold text-primary">
                  KSh {calculateReactivatePrice().toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {reactivateFormData.tier === 'premium' ? 'KSh 300' : 'KSh 128'} × {reactivateFormData.duration_days} days
              </p>
            </div>

            {/* Content Duration */}
            <div>
              <Label htmlFor="reactivate_content_duration">
                Content Duration (seconds) *
                {reactivateFormData.tier === 'basic' && ' (15-30 seconds)'}
                {reactivateFormData.tier === 'premium' && ' (up to 60 seconds)'}
              </Label>
              <Input
                id="reactivate_content_duration"
                type="number"
                min={reactivateFormData.tier === 'basic' ? 15 : 1}
                max={reactivateFormData.tier === 'basic' ? 30 : 60}
                value={reactivateFormData.content_duration}
                onChange={(e) => {
                  const duration = parseInt(e.target.value) || (reactivateFormData.tier === 'basic' ? 15 : 30);
                  setReactivateFormData({ ...reactivateFormData, content_duration: duration });
                }}
              />
            </div>

            {/* Page Locations */}
            <div>
              <Label>Select Pages * (Multiple selections allowed)</Label>
              <div className="space-y-2 mt-2">
                {[
                  { value: 'homepage', label: 'Home Page' },
                  { value: 'products', label: 'Products Page' },
                  { value: 'blog', label: 'Blog Page' },
                  { value: 'training', label: 'Training Page' }
                ].map((page) => (
                  <label key={page.value} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={reactivateFormData.page_locations.includes(page.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setReactivateFormData({
                            ...reactivateFormData,
                            page_locations: [...reactivateFormData.page_locations, page.value]
                          });
                        } else {
                          setReactivateFormData({
                            ...reactivateFormData,
                            page_locations: reactivateFormData.page_locations.filter(p => p !== page.value)
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{page.label}</span>
                  </label>
                ))}
              </div>
              {reactivateFormData.page_locations.length === 0 && (
                <p className="text-xs text-red-600 mt-1">Please select at least one page</p>
              )}
            </div>

            {/* Activate Immediately (Admin only) */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="activate_immediately"
                checked={reactivateFormData.activate_immediately}
                onChange={(e) => setReactivateFormData({ ...reactivateFormData, activate_immediately: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="activate_immediately" className="cursor-pointer">
                Activate immediately (skip approval)
              </Label>
            </div>

            {/* Ad Title */}
            <div>
              <Label htmlFor="reactivate_ad_title">Advertisement Title</Label>
              <Input
                id="reactivate_ad_title"
                value={reactivateFormData.ad_title}
                onChange={(e) => setReactivateFormData({ ...reactivateFormData, ad_title: e.target.value })}
                placeholder="Enter a catchy title for your ad"
              />
            </div>

            {/* Ad Description */}
            <div>
              <Label htmlFor="reactivate_ad_description">Advertisement Description</Label>
              <Textarea
                id="reactivate_ad_description"
                value={reactivateFormData.ad_description}
                onChange={(e) => setReactivateFormData({ ...reactivateFormData, ad_description: e.target.value })}
                placeholder="Describe your product or promotion"
                rows={4}
              />
            </div>

            {/* Discount Prices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reactivate_previous_price">Previous Price (Optional)</Label>
                <Input
                  id="reactivate_previous_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={reactivateFormData.previous_price}
                  onChange={(e) => setReactivateFormData({ ...reactivateFormData, previous_price: e.target.value })}
                  placeholder="e.g., 5000"
                />
              </div>
              <div>
                <Label htmlFor="reactivate_current_price">Current/Discounted Price (Optional)</Label>
                <Input
                  id="reactivate_current_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={reactivateFormData.current_price}
                  onChange={(e) => setReactivateFormData({ ...reactivateFormData, current_price: e.target.value })}
                  placeholder="e.g., 3500"
                />
              </div>
            </div>

            {/* Ad Image */}
            <div>
              <Label>Advertisement Image/Video</Label>
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                    toast.error('Please select an image or video file');
                    return;
                  }
                  try {
                    setUploadingImage(true);
                    const url = await uploadImage(file);
                    setReactivateFormData({ ...reactivateFormData, ad_image: url });
                    toast.success('Image uploaded successfully');
                  } catch (error) {
                    toast.error('Failed to upload image');
                  } finally {
                    setUploadingImage(false);
                  }
                }}
                className="mt-2"
                disabled={uploadingImage}
              />
              {reactivateFormData.ad_image && (
                <div className="mt-2">
                  {reactivateFormData.ad_image.endsWith('.mp4') || 
                   reactivateFormData.ad_image.endsWith('.webm') || 
                   reactivateFormData.ad_image.endsWith('.mov') ? (
                    <video
                      src={getImageUrl(reactivateFormData.ad_image)}
                      className="w-full h-48 object-cover rounded-lg border"
                      controls
                    />
                  ) : (
                    <img
                      src={getImageUrl(reactivateFormData.ad_image)}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                  )}
                </div>
              )}
              {uploadingImage && (
                <p className="text-sm text-gray-500 mt-2">Uploading...</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivatingAd(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReactivate} 
              disabled={reactivating || uploadingImage || reactivateFormData.page_locations.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {reactivating ? 'Reactivating...' : reactivateFormData.activate_immediately ? 'Reactivate & Activate Now' : 'Reactivate (Pending Approval)'}
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
    </div>
  );
};

export default AdminAdvertisementManager;


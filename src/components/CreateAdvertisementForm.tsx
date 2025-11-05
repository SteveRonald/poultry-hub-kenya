import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Upload, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { getApiUrl, getImageUrl } from '../config/api';
import { toast } from 'sonner';
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';

interface Product {
  id: string;
  name: string;
  price: number;
  image_urls: string;
}

interface CreateAdvertisementFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateAdvertisementForm: React.FC<CreateAdvertisementFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contentDuration, setContentDuration] = useState<number | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    product_id: '',
    tier: 'basic' as 'basic' | 'premium',
    duration_days: 1,
    ad_title: '',
    ad_description: '',
    ad_image: '',
    previous_price: '',
    current_price: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/vendor/products'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(Array.isArray(data) ? data.filter((p: any) => p.is_active) : []);
    } catch (error) {
      toast.error('Failed to load products');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please select an image or video file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    // If it's a video, try to get duration
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = Math.round(video.duration);
        setContentDuration(duration);
        validateContentDuration(duration, formData.tier);
      };
      video.src = URL.createObjectURL(file);
    } else {
      // For images, user needs to input duration manually or we use default
      setContentDuration(null);
    }
  };

  const validateContentDuration = (duration: number, tier: string) => {
    if (tier === 'basic') {
      if (duration < 15 || duration > 30) {
        setDurationError('Basic tier ads must be between 15-30 seconds');
        return false;
      }
    } else if (tier === 'premium') {
      if (duration > 60) {
        setDurationError('Premium tier ads must be up to 60 seconds');
        return false;
      }
    }
    setDurationError(null);
    return true;
  };

  const handleDurationInputChange = (value: string) => {
    const duration = parseInt(value) || 0;
    setContentDuration(duration);
    validateContentDuration(duration, formData.tier);
  };

  const handleTierChange = (tier: 'basic' | 'premium') => {
    setFormData({ ...formData, tier });
    if (contentDuration !== null) {
      validateContentDuration(contentDuration, tier);
    }
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

    // Upload endpoint returns 'url' or 'image_url', handle both
    return data.url || data.image_url || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      if (!formData.product_id) {
        toast.error('Please select a product');
        setLoading(false);
        return;
      }

      if (!selectedFile && !formData.ad_image) {
        toast.error('Please upload an advertisement image or video');
        setLoading(false);
        return;
      }

      if (formData.tier === 'basic' && contentDuration !== null) {
        if (contentDuration < 15 || contentDuration > 30) {
          toast.error('Basic tier ads must be between 15-30 seconds');
          setLoading(false);
          return;
        }
      }

      if (formData.tier === 'premium' && contentDuration !== null) {
        if (contentDuration > 60) {
          toast.error('Premium tier ads must be up to 60 seconds');
          setLoading(false);
          return;
        }
      }

      // Upload image if new file selected
      let imageUrl = formData.ad_image;
      if (selectedFile) {
        setUploading(true);
        imageUrl = await uploadImage(selectedFile);
        setUploading(false);
      }

      // Calculate price
      const tierPrice = formData.tier === 'premium' ? 300 : 128;
      const totalPrice = tierPrice * formData.duration_days;

      // Submit advertisement
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/vendor/advertisements'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: formData.product_id,
          tier: formData.tier,
          duration_days: formData.duration_days,
          ad_image: imageUrl,
          ad_title: formData.ad_title,
          ad_description: formData.ad_description,
          content_duration: contentDuration,
          previous_price: formData.previous_price ? parseFloat(formData.previous_price) : null,
          current_price: formData.current_price ? parseFloat(formData.current_price) : null
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Advertisement created successfully! Awaiting admin approval.');
        setFormData({
          product_id: '',
          tier: 'basic',
          duration_days: 1,
          ad_title: '',
          ad_description: '',
          ad_image: '',
          previous_price: '',
          current_price: ''
        });
        setSelectedFile(null);
        setPreviewUrl(null);
        setContentDuration(null);
        setDurationError(null);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.error || 'Failed to create advertisement');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create advertisement');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const calculatePrice = () => {
    const tierPrice = formData.tier === 'premium' ? 300 : 128;
    return tierPrice * formData.duration_days;
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create New Advertisement</DialogTitle>
        <DialogDescription>
          Fill in the details below to create a new advertisement. Once submitted, it will be reviewed by an admin before going live.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Product Selection */}
          <div>
            <Label htmlFor="product_id">Select Product *</Label>
            <Select
              value={formData.product_id}
              onValueChange={(value) => setFormData({ ...formData, product_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a product to advertise" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - KSh {product.price.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tier Selection */}
          <div>
            <Label htmlFor="tier">Advertisement Tier *</Label>
            <Select
              value={formData.tier}
              onValueChange={(value) => handleTierChange(value as 'basic' | 'premium')}
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
            <p className="text-xs text-gray-500 mt-1">
              {formData.tier === 'basic'
                ? 'Basic ads: Lower cost, shorter duration (15-30s), can be closed by users'
                : 'Premium ads: Higher visibility, longer duration (up to 60s), cannot be closed'}
            </p>
          </div>

          {/* Duration Days */}
          <div>
            <Label htmlFor="duration_days">Duration (Days) *</Label>
            <Input
              id="duration_days"
              type="number"
              min="1"
              value={formData.duration_days}
              onChange={(e) =>
                setFormData({ ...formData, duration_days: parseInt(e.target.value) || 1 })
              }
            />
          </div>

          {/* Content Duration (for video) */}
          <div>
            <Label htmlFor="content_duration">
              Content Duration (Seconds)
              {formData.tier === 'basic' && <span className="text-red-500"> *</span>}
            </Label>
            <Input
              id="content_duration"
              type="number"
              min={formData.tier === 'basic' ? 15 : 0}
              max={formData.tier === 'premium' ? 60 : 30}
              value={contentDuration || ''}
              onChange={(e) => handleDurationInputChange(e.target.value)}
              placeholder={
                formData.tier === 'basic'
                  ? 'Enter duration (15-30 seconds)'
                  : 'Enter duration (up to 60 seconds)'
              }
            />
            {durationError && (
              <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {durationError}
              </p>
            )}
            {contentDuration !== null && !durationError && (
              <p className="text-sm text-green-500 mt-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Duration is valid
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {formData.tier === 'basic'
                ? 'Required: Between 15-30 seconds'
                : 'Optional: Up to 60 seconds'}
            </p>
          </div>

          {/* Discount Prices (Optional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="previous_price">Previous Price (Optional)</Label>
              <Input
                id="previous_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.previous_price}
                onChange={(e) =>
                  setFormData({ ...formData, previous_price: e.target.value })
                }
                placeholder="e.g., 5000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Original price before discount (will be shown struck through)
              </p>
            </div>
            <div>
              <Label htmlFor="current_price">Current/Discounted Price (Optional)</Label>
              <Input
                id="current_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.current_price}
                onChange={(e) =>
                  setFormData({ ...formData, current_price: e.target.value })
                }
                placeholder="e.g., 3500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Discounted price (will be highlighted in green)
              </p>
            </div>
          </div>
          {formData.previous_price && formData.current_price && 
           parseFloat(formData.previous_price) <= parseFloat(formData.current_price) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Current price should be less than previous price for discount to work.
              </p>
            </div>
          )}

          {/* Ad Image/Video Upload */}
          <div>
            <Label>Advertisement Image/Video *</Label>
            <div className="mt-2">
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="ad-upload"
              />
              <Label
                htmlFor="ad-upload"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary transition-colors"
              >
                {previewUrl ? (
                  <div className="relative w-full h-full">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setContentDuration(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                      aria-label="Remove image"
                      title="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Click to upload image or video
                    </p>
                    <p className="text-xs text-gray-500">Max 10MB</p>
                  </div>
                )}
              </Label>
            </div>
          </div>

          {/* Ad Title */}
          <div>
            <Label htmlFor="ad_title">Advertisement Title</Label>
            <Input
              id="ad_title"
              value={formData.ad_title}
              onChange={(e) => setFormData({ ...formData, ad_title: e.target.value })}
              placeholder="Enter a catchy title for your ad"
            />
          </div>

          {/* Ad Description */}
          <div>
            <Label htmlFor="ad_description">Advertisement Description</Label>
            <Textarea
              id="ad_description"
              value={formData.ad_description}
              onChange={(e) => setFormData({ ...formData, ad_description: e.target.value })}
              placeholder="Describe your product or promotion"
              rows={4}
            />
          </div>

          {/* Price Summary */}
          <Card className="bg-blue-50">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-primary">
                    KSh {calculatePrice().toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formData.tier === 'premium' ? 'KSh 300' : 'KSh 128'} × {formData.duration_days} days
                  </p>
                </div>
                <Badge variant={formData.tier === 'premium' ? 'default' : 'secondary'}>
                  {formData.tier.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <DialogFooter>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading || uploading || !!durationError}
            >
              {loading || uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? 'Uploading...' : 'Creating...'}
                </>
              ) : (
                'Create Advertisement'
              )}
            </Button>
          </DialogFooter>
        </form>
    </>
  );
};

export default CreateAdvertisementForm;



import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ShoppingCart, Star, MapPin, Plus, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { useProducts, Product } from '../hooks/useProducts';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';
import AdvertisementBanner from '../components/AdvertisementBanner';

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedProductId = searchParams.get('product');
  const productRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState<{ name: string; description: string } | null>(null);
  const [quickOrderData, setQuickOrderData] = useState({
    quantity: 1,
    shipping_address: '',
    contact_phone: '',
    payment_method: 'mpesa',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [advertisements, setAdvertisements] = useState<any[]>([]);
  const [visibleAds, setVisibleAds] = useState<Set<string>>(new Set());
  const { addToCart, loading: cartLoading } = useCart();
  const { user } = useAuth();
  
  // Function to check if description needs truncation (more than ~150 characters or 2 lines)
  const needsTruncation = (description: string): boolean => {
    if (!description) return false;
    // Check if description is longer than approximately 2 lines (150 chars is roughly 2 lines at text-sm)
    return description.length > 150 || description.split('\n').filter(line => line.trim().length > 0).length > 2;
  };
  
  // Function to handle viewing full description
  const handleViewDescription = (product: Product) => {
    setSelectedDescription({
      name: product.name,
      description: product.description
    });
    setShowDescriptionModal(true);
  };

  // Handle ESC key to close description modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDescriptionModal) {
        setShowDescriptionModal(false);
        setSelectedDescription(null);
      }
    };

    if (showDescriptionModal) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [showDescriptionModal]);

  useEffect(() => {
    fetchAdvertisements();
  }, []);

  const fetchAdvertisements = async () => {
    try {
      const response = await fetch(getApiUrl('/api/advertisements?limit=3&page_location=products'));
      const data = await response.json();
      if (Array.isArray(data)) {
        setAdvertisements(data);
        // Show all ads initially (up to 3)
        const initialAds = new Set(data.slice(0, 3).map((ad: any) => ad.id));
        setVisibleAds(initialAds);
      }
    } catch (error) {
      console.error('Failed to fetch advertisements:', error);
    }
  };

  const handleAdClose = (adId: string) => {
    setVisibleAds(prev => {
      const newSet = new Set(prev);
      newSet.delete(adId);
      return newSet;
    });
  };

  const { data: products = [], isLoading, error } = useProducts(
    searchTerm || undefined,
    selectedCategory,
    selectedLocation
  );

  // Scroll to and highlight product when product query parameter is present
  useEffect(() => {
    if (highlightedProductId && products.length > 0) {
      // Find the product in the current products list
      const product = products.find(p => p.id === highlightedProductId);
      
      if (product && productRefs.current[highlightedProductId]) {
        // Scroll to the product with smooth behavior
        setTimeout(() => {
          productRefs.current[highlightedProductId]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 300); // Small delay to ensure products are rendered

        // Show a toast notification
        toast.success(`Product highlighted: ${product.name}`, {
          duration: 3000,
        });
      }
    }
  }, [highlightedProductId, products]);

  const handleAddToCart = async (productId: string) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return;
    }
    
    await addToCart(productId, 1); // Context handles toasts
  };

  // Get unique locations from products
  const locations: string[] = ['all', ...Array.from(new Set(products.map(p => p.vendor_profiles.location)))];

  const handleQuickOrder = (product: any) => {
    if (!user) {
      toast.error('Please login to place an order');
      return;
    }

    setSelectedProduct(product);
    setQuickOrderData({
      quantity: 1,
      shipping_address: '',
      contact_phone: '',
      payment_method: 'mpesa',
      notes: ''
    });
    setShowQuickOrderModal(true);
  };

  const handleQuickOrderSubmit = async () => {
    if (!selectedProduct) return;

    // Validate form data
    if (!quickOrderData.shipping_address.trim()) {
      toast.error('Shipping address is required');
      return;
    }

    if (!quickOrderData.contact_phone.trim()) {
      toast.error('Contact phone is required');
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      
      // Get advertisement_id from URL params or sessionStorage
      const adParam = searchParams.get('ad');
      const pendingOrder = sessionStorage.getItem('pending_order');
      let advertisementId = adParam;
      
      if (!advertisementId && pendingOrder) {
        try {
          const orderContext = JSON.parse(pendingOrder);
          if (orderContext.advertisement_id && orderContext.product_id === selectedProduct.id) {
            advertisementId = orderContext.advertisement_id;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Clear pending order from sessionStorage after use
      if (pendingOrder) {
        sessionStorage.removeItem('pending_order');
      }
      
      const response = await fetch(getApiUrl('/api/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          quantity: quickOrderData.quantity,
          shipping_address: quickOrderData.shipping_address.trim(),
          contact_phone: quickOrderData.contact_phone.trim(),
          payment_method: quickOrderData.payment_method,
          notes: quickOrderData.notes.trim() || 'Quick order from products page',
          ...(advertisementId && { advertisement_id: advertisementId })
        })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails but response is OK, order might still be created
        if (response.ok) {
          toast.warning('Order may have been placed, but we could not confirm. Please check your orders.');
          setShowQuickOrderModal(false);
          setSelectedProduct(null);
          setQuickOrderData({
            quantity: 1,
            shipping_address: '',
            contact_phone: '',
            payment_method: 'mpesa',
            notes: ''
          });
          return;
        } else {
          throw jsonError;
        }
      }

      if (response.ok && data.success !== false) {
        // Show appropriate message based on email status
        if (data.customer_email_sent === false) {
          toast.warning(data.message || 'Order sent successfully, but we could not send the confirmation email.');
        } else {
          toast.success(data.message || `Order placed successfully! Order Number: ${data.order_number}`);
        }
        setShowQuickOrderModal(false);
        setSelectedProduct(null);
        setQuickOrderData({
          quantity: 1,
          shipping_address: '',
          contact_phone: '',
          payment_method: 'mpesa',
          notes: ''
        });
      } else {
        // Order creation failed
        toast.error(data.error || data.message || 'Failed to place order. Please try again.');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error placing order:', error);
      }
      // Network error or other exception - don't assume order failed
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('An error occurred while placing your order. Please check your orders to confirm if it was placed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Check if there's a premium ad (top banner) to add padding
  const hasPremiumAd = advertisements.some(ad => 
    visibleAds.has(ad.id) && ad.tier === 'premium'
  );

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        {/* Add padding-top if premium ad is displayed at top */}
        {hasPremiumAd && <div style={{ height: '90px' }} />}
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-primary mb-4">Error Loading Products</h1>
            <p className="text-gray-600">We're having trouble loading the products. Please try again later.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Add padding-top if premium ad is displayed at top */}
      {hasPremiumAd && <div style={{ height: '120px' }} />}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Browse Products</h1>
            <p className="text-gray-600">Find quality poultry products from trusted farmers across Kenya</p>
          </div>

          {/* Advertisements - Floating Overlays (Premium: top banner, Basic: bottom-right popup) */}
          {advertisements.length > 0 && (
            <>
              {advertisements.map((ad) => (
                visibleAds.has(ad.id) && (
                  <AdvertisementBanner
                    key={ad.id}
                    advertisement={ad}
                    onClose={() => handleAdClose(ad.id)}
                    pageLocation="products"
                  />
                )
              ))}
            </>
          )}

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search products or vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="chicks">Chicks</SelectItem>
                  <SelectItem value="eggs">Eggs</SelectItem>
                  <SelectItem value="chickens">Chickens</SelectItem>
                  <SelectItem value="feed">Feed</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="medicine">Medicine</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location === 'all' ? 'All Locations' : location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading products...</p>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => {
                const isHighlighted = highlightedProductId === product.id;
                return (
                <Card 
                  key={product.id} 
                  ref={(el) => { productRefs.current[product.id] = el; }}
                  className={`card-hover overflow-hidden transition-all duration-500 ${
                    isHighlighted 
                      ? 'ring-4 ring-yellow-400 ring-offset-4 shadow-2xl scale-105 z-10 border-4 border-yellow-400' 
                      : ''
                  }`}
                  style={{
                    animation: isHighlighted ? 'pulse 2s ease-in-out' : undefined
                  }}
                >
                  {isHighlighted && (
                    <div className="absolute -top-2 -right-2 z-20 bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-bounce">
                      ADVERTISED PRODUCT
                    </div>
                  )}
                  <div className="relative h-48">
                    <img 
                      src={(() => {
                        // Handle both old single image_url and new image_urls array
                        if (product.image_url && product.image_url.startsWith('[')) {
                          try {
                            const images = JSON.parse(product.image_url);
                            const imageUrl = images.length > 0 ? images[0].replace(/\\/g, '/') : 'https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp?a=1&b=1&s=612x612&w=0&k=20&c=W6Cdm-2XcJOXfmNgYIxYVLQ0DEnDDgsSt1O-EemeYUc?w=800';
                            return getImageUrl(imageUrl);
                          } catch (e) {
                            const imageUrl = product.image_url || 'https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp?a=1&b=1&s=612x612&w=0&k=20&c=W6Cdm-2XcJOXfmNgYIxYVLQ0DEnDDgsSt1O-EemeYUc?w=800';
                            return getImageUrl(imageUrl);
                          }
                        }
                        const imageUrl = product.image_url || 'https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp?a=1&b=1&s=612x612&w=0&k=20&c=W6Cdm-2XcJOXfmNgYIxYVLQ0DEnDDgsSt1O-EemeYUc?w=800';
                        return getImageUrl(imageUrl);
                      })()} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-accent text-black px-2 py-1 rounded-full text-sm font-medium">
                      KSH {product.price.toLocaleString()}
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg text-primary mb-2">{product.name}</h3>
                    <div className="mb-3">
                      <div className={`text-gray-600 text-sm ${needsTruncation(product.description) ? 'line-clamp-2' : ''}`}>
                        {product.description}
                      </div>
                      {needsTruncation(product.description) && (
                        <button
                          onClick={() => handleViewDescription(product)}
                          className="text-primary hover:text-primary/80 text-sm font-semibold mt-2 focus:outline-none focus:underline transition-colors inline-flex items-center"
                        >
                          View More
                          <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1" />
                        {product.vendor_profiles.location}
                      </div>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-accent fill-current mr-1" />
                        <span className="text-sm font-medium">4.8</span>
                        <span className="text-sm text-gray-500 ml-1">(24)</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">by {product.vendor_profiles.farm_name}</p>
                        <p className="text-lg font-bold text-primary">
                          KSH {product.price.toLocaleString()} / {product.unit}
                        </p>
                        <p className="text-xs text-gray-500">Stock: {product.stock_quantity} {product.unit}s</p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <Button 
                          className="btn-primary flex items-center w-full"
                          onClick={() => handleAddToCart(product.id)}
                          disabled={cartLoading || product.stock_quantity <= 0}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add to Cart
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex items-center w-full"
                          onClick={() => handleQuickOrder(product)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Quick Order
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {!isLoading && products.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
              <p className="text-gray-400 mt-2">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* Description Modal */}
      {showDescriptionModal && selectedDescription && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              setShowDescriptionModal(false);
              setSelectedDescription(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-semibold text-primary pr-4">{selectedDescription.name}</h2>
                <button
                  onClick={() => {
                    setShowDescriptionModal(false);
                    setSelectedDescription(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Product Description</h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed text-base">
                    {selectedDescription.description}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDescriptionModal(false);
                    setSelectedDescription(null);
                  }}
                  className="min-w-[100px]"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Order Modal */}
      {showQuickOrderModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Quick Order</h2>
                <button
                  onClick={() => setShowQuickOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Product Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900">{selectedProduct.name}</h3>
                <p className="text-sm text-gray-600 mt-1">KSH {selectedProduct.price}</p>
                <p className="text-sm text-gray-500 mt-1">Vendor: {selectedProduct.vendor_profiles?.farm_name || 'Unknown'}</p>
                
                {/* Quantity Controls */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQuickOrderData(prev => ({ 
                        ...prev, 
                        quantity: Math.max(1, prev.quantity - 1) 
                      }))}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      disabled={quickOrderData.quantity <= 1}
                    >
                      <span className="text-gray-600">-</span>
                    </button>
                    <span className="w-12 text-center font-medium">{quickOrderData.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuickOrderData(prev => ({ 
                        ...prev, 
                        quantity: prev.quantity + 1 
                      }))}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      <span className="text-gray-600">+</span>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Total: KSH {(selectedProduct.price * quickOrderData.quantity).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Order Form */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="shipping_address" className="block text-sm font-medium text-gray-700 mb-1">
                    Shipping Address *
                  </label>
                  <Textarea
                    id="shipping_address"
                    value={quickOrderData.shipping_address}
                    onChange={(e) => setQuickOrderData(prev => ({ ...prev, shipping_address: e.target.value }))}
                    placeholder="Enter your complete shipping address..."
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone *
                  </label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    value={quickOrderData.contact_phone}
                    onChange={(e) => setQuickOrderData(prev => ({ ...prev, contact_phone: e.target.value }))}
                    placeholder="Enter your phone number..."
                    required
                  />
                </div>

                <div>
                  <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    id="payment_method"
                    value={quickOrderData.payment_method}
                    onChange={(e) => setQuickOrderData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Order Notes (Optional)
                  </label>
                  <Textarea
                    id="notes"
                    value={quickOrderData.notes}
                    onChange={(e) => setQuickOrderData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any special instructions or notes..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowQuickOrderModal(false)}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickOrderSubmit}
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Placing Order...
                    </div>
                  ) : (
                    'Place Order'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;

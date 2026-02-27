import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Plus, Minus, Star, MapPin, Check, ChevronDown, ChevronUp, X, Share2, ExternalLink } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';
import ProductRatings from '../components/ProductRatings';
import ChatButton from '../components/ChatButton';

interface ProductDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock_quantity: number;
  minimum_order_quantity?: number;
  unit: string;
  image_urls: string | string[];
  vendor_profiles: {
    id: number;
    farm_name: string;
    location: string;
    user_id?: number;
  };
  average_rating?: number;
  total_ratings?: number;
}

interface RelatedProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock_quantity: number;
  minimum_order_quantity?: number;
  unit: string;
  image_url?: string | null;
  image_urls?: string | string[];
  average_rating?: number;
  total_ratings?: number;
  vendor_profiles?: {
    farm_name?: string;
    location?: string;
    user_id?: number | string;
  };
  vendor_id?: string;
  vendor_user_id?: string;
}

// Component for truncated description with View More/Less
const DescriptionText = ({ description }: { description: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 200; // Characters to show before truncation
  
  if (!description) return null;
  
  const shouldTruncate = description.length > maxLength;
  const displayText = isExpanded || !shouldTruncate 
    ? description 
    : `${description.substring(0, maxLength)}...`;
  
  return (
    <div>
      <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed">
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              <span>View Less</span>
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>View More</span>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
};

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const adId = searchParams.get('ad');
  const { addToCart, loading: cartLoading } = useCart();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const ratingsRef = useRef<HTMLDivElement | null>(null);

  // Update quantity when product loads to respect minimum order quantity
  useEffect(() => {
    if (product && product.minimum_order_quantity && product.minimum_order_quantity > 1) {
      setQuantity(product.minimum_order_quantity);
    }
  }, [product]);

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, [id, adId]);

  const fetchProduct = async (productId: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = getApiUrl(`/api/products/${productId}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        let errorMessage = 'Product not found';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Validate that we got product data
      if (!data || !data.id) {
        throw new Error('Invalid product data received');
      }
      
      setProduct(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load product';
      setError(errorMessage);
      console.error('Error fetching product:', err);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const scrollToRatings = () => {
    if (!ratingsRef.current) return;
    ratingsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleShare = async () => {
    if (!product) return;

    const url = shareUrl || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on KukuSoko`,
          url
        });
        return;
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) toast.success('Link copied to clipboard');
      else toast.error('Failed to copy link');
    } catch (e) {
      toast.error('Failed to share link');
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    const minQty = product.minimum_order_quantity || 1;
    const finalQuantity = Math.max(quantity, minQty);

    // Allow adding to cart without login - save to local storage
    if (!user) {
      const localCart = JSON.parse(localStorage.getItem('local_cart') || '[]');
      const existingItem = localCart.find((item: any) => item.product_id === product.id);
      
      // Get first image
      const imageUrl = images && images.length > 0 ? images[0] : '';
      
      if (existingItem) {
        existingItem.quantity += finalQuantity;
      } else {
        localCart.push({
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: finalQuantity,
          unit: product.unit,
          image_url: imageUrl,
          minimum_order_quantity: minQty,
          category: product.category || ''
        });
      }
      
      localStorage.setItem('local_cart', JSON.stringify(localCart));
      toast.success(`Added ${finalQuantity} ${product.unit}(s) to cart`);
      return;
    }
    
    // User is logged in - add to database cart
    addToCart(product.id, finalQuantity);
    toast.success(`Added ${finalQuantity} ${product.unit}(s) to cart`);
  };

  const handleOrderNow = async () => {
    if (!product) return;
    
    const minQty = product.minimum_order_quantity || 1;
    const finalQuantity = Math.max(quantity, minQty);

    // Always add to cart first (whether logged in or not)
    if (!user) {
      // Add to local cart if not logged in
      const localCart = JSON.parse(localStorage.getItem('local_cart') || '[]');
      const existingItem = localCart.find((item: any) => item.product_id === product.id);
      
      // Get first image
      const imageUrl = images && images.length > 0 ? images[0] : '';
      
      if (existingItem) {
        existingItem.quantity += finalQuantity;
      } else {
        localCart.push({
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: finalQuantity,
          unit: product.unit,
          image_url: imageUrl,
          minimum_order_quantity: minQty,
          category: product.category || ''
        });
      }
      
      localStorage.setItem('local_cart', JSON.stringify(localCart));
      toast.success(`Added ${finalQuantity} ${product.unit}(s) to cart`);
    } else {
      // Add to database cart if logged in
      await addToCart(product.id, finalQuantity);
    }
    
    // Navigate to checkout page with all cart items
    navigate('/checkout');
  };

  const getProductImages = (): string[] => {
    if (!product) return [];
    
    try {
      if (typeof product.image_urls === 'string') {
        const parsed = JSON.parse(product.image_urls);
        if (Array.isArray(parsed)) {
          return parsed.map((img: string) => getImageUrl(img.replace(/\\/g, '/')));
        }
      } else if (Array.isArray(product.image_urls)) {
        return product.image_urls.map((img: string) => getImageUrl(img.replace(/\\/g, '/')));
      }
    } catch (e) {
      // Fallback to single image
    }
    
    // Fallback to default image
    return ['https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp'];
  };

  const images = getProductImages();
  const mainImage = images[selectedImageIndex] || images[0];
  const mapsUrl = useMemo(() => {
    const location = product?.vendor_profiles?.location || '';
    if (!location) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  }, [product?.vendor_profiles?.location]);

  useEffect(() => {
    if (!product?.category) {
      setRelatedProducts([]);
      return;
    }

    const controller = new AbortController();
    const loadRelated = async () => {
      setRelatedLoading(true);
      try {
        const response = await fetch(getApiUrl(`/api/products?category=${encodeURIComponent(product.category)}`), {
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Failed to load related products');
        const data = await response.json();
        const items: RelatedProduct[] = Array.isArray(data) ? data : [];
        const filtered = items.filter(p => String(p.id) !== String(product.id)).slice(0, 8);
        setRelatedProducts(filtered);
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') setRelatedProducts([]);
      } finally {
        setRelatedLoading(false);
      }
    };

    loadRelated();
    return () => controller.abort();
  }, [product?.category, product?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading product details...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
            <p className="text-gray-600 mb-8">{error || 'The product you are looking for does not exist.'}</p>
            <Button onClick={() => navigate('/products')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Highlight badge if coming from ad */}
      {adId && (
        <div className="bg-yellow-400 text-black text-center py-2 px-4 font-semibold">
          Viewing Product from Advertisement
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Product Details Layout: Images Left, Details Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Side: Images */}
          <div className="space-y-3">
            {/* Main Image */}
            <div className="relative aspect-square max-w-md mx-auto lg:max-w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 justify-center lg:justify-start">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? 'border-primary ring-1 ring-primary ring-offset-1'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Product Details */}
          <div className="space-y-4">
            {/* Product Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
                {product.name}
              </h1>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <MapPin className="h-3.5 w-3.5 mr-1" />
                    {product.vendor_profiles.location}
                  </div>

                  {product.average_rating && product.average_rating > 0 ? (
                    <button
                      type="button"
                      onClick={scrollToRatings}
                      className="flex items-center gap-1 hover:opacity-90"
                      aria-label="Jump to ratings and reviews"
                      title="Jump to ratings and reviews"
                    >
                      <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium text-gray-900">
                        {product.average_rating.toFixed(1)}
                      </span>
                      {product.total_ratings && product.total_ratings > 0 && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({product.total_ratings})
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-gray-300" />
                      <span className="text-xs text-gray-500">No ratings yet</span>
                    </div>
                  )}

                  {product.stock_quantity > 0 ? (
                    <Badge className={product.stock_quantity < 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                      {product.stock_quantity < 10 ? 'Limited stock' : 'In stock'}
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">Out of stock</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {mapsUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
                      className="h-9"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Maps
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="h-9"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="border-t border-b border-gray-200 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">
                  KSH {product.price.toLocaleString()}
                </span>
                <span className="text-base text-gray-600">/ {product.unit}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Stock: {product.stock_quantity} {product.unit}(s) available
              </p>
              <p className="text-sm text-orange-600 font-medium mt-1">
                Minimum Order: {product.minimum_order_quantity || 1} {product.unit}(s)
              </p>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <DescriptionText description={product.description} />
            </div>

            {/* Vendor Info */}
            <Card>
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm mb-2">Vendor Information</h3>
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Farm:</span> {product.vendor_profiles.farm_name}
                </p>
                <p className="text-gray-700 text-sm">
                  <span className="font-medium">Location:</span> {product.vendor_profiles.location}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Tip: Use chat to confirm availability, delivery options, and pickup details before ordering.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quantity Selector */}
            <div className="flex items-center gap-3">
              <label className="font-medium text-sm">Quantity:</label>
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity(Math.max(product.minimum_order_quantity || 1, quantity - 1))}
                  disabled={quantity <= (product.minimum_order_quantity || 1)}
                  className="h-9 w-9"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="px-3 py-1.5 min-w-[50px] text-center font-semibold text-sm">
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                  disabled={quantity >= product.stock_quantity}
                  className="h-9 w-9"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <span className="text-xs text-gray-600">
                Max: {product.stock_quantity}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-white h-11"
                onClick={handleAddToCart}
                disabled={cartLoading || product.stock_quantity <= 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={handleOrderNow}
                disabled={product.stock_quantity <= 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Order Now
              </Button>
            </div>

            {/* Chat action separated to avoid mis-clicks */}
            <div className="pt-3 border-t mt-2">
              <ChatButton
                productId={product.id}
                vendorId={product.vendor_id}
                vendorUserId={product.vendor_profiles?.user_id}
                className="w-full h-10 text-sm"
              />
            </div>

            {/* Stock Status */}
            {product.stock_quantity <= 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 font-medium text-sm flex items-center">
                  <X className="h-4 w-4 mr-2" />
                  Out of Stock
                </p>
              </div>
            )}

            {product.stock_quantity > 0 && product.stock_quantity < 10 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 font-medium text-sm flex items-center">
                  <Check className="h-4 w-4 mr-2" />
                  Limited Stock Available
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ratings Section - Full width on mobile */}
        <div ref={ratingsRef} className="mt-6 sm:mt-8 w-full -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <ProductRatings 
              productId={product.id} 
              vendorUserId={product.vendor_profiles?.user_id}
            />
          </div>
        </div>

        {/* Related Products */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              More in {product.category || 'this category'}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/products?category=${encodeURIComponent(product.category || '')}`)}
            >
              View category
            </Button>
          </div>

          {relatedLoading && (
            <div className="text-sm text-gray-500 py-4">Loading related products...</div>
          )}

          {!relatedLoading && relatedProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {relatedProducts.map((p) => {
                const imgAny: any = (p as any).image_urls ?? p.image_urls;
                let img = p.image_url || '';
                if (imgAny && Array.isArray(imgAny) && imgAny.length > 0) {
                  img = String(imgAny[0]);
                } else if (typeof imgAny === 'string') {
                  try {
                    const parsed = JSON.parse(imgAny);
                    if (Array.isArray(parsed) && parsed.length > 0) img = String(parsed[0]);
                  } catch (e) {
                    // ignore
                  }
                }

                const safeImg = img
                  ? getImageUrl(String(img).replace(/\\/g, '/'))
                  : 'https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp';

                return (
                  <Card
                    key={p.id}
                    className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      navigate(`/product/${p.id}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <img src={safeImg} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute top-2 right-2 bg-white/95 px-2 py-1 rounded text-xs font-semibold">
                        KSH {Number(p.price || 0).toLocaleString()}
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-1">
                      <div className="font-semibold text-sm line-clamp-2 text-primary">{p.name}</div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate">{p.vendor_profiles?.location || ''}</span>
                        {(p.average_rating || 0) > 0 ? (
                          <span className="flex items-center gap-1 text-gray-700">
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                            {Number(p.average_rating || 0).toFixed(1)}
                          </span>
                        ) : (
                          <span />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Stock: {Number(p.stock_quantity || 0)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!relatedLoading && relatedProducts.length === 0 && (
            <div className="text-sm text-gray-500 py-4">No related products found.</div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProductDetails;

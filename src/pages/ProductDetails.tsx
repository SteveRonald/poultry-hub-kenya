import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Plus, Minus, Star, MapPin, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';
import ProductRatings from '../components/ProductRatings';

interface ProductDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock_quantity: number;
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

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

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

  const handleAddToCart = () => {
    if (!product) return;
    
    // Allow adding to cart without login - save to local storage
    if (!user) {
      const localCart = JSON.parse(localStorage.getItem('local_cart') || '[]');
      const existingItem = localCart.find((item: any) => item.product_id === product.id);
      
      // Get first image
      const imageUrl = images && images.length > 0 ? images[0] : '';
      
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        localCart.push({
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: quantity,
          unit: product.unit,
          image_url: imageUrl,
          category: product.category || ''
        });
      }
      
      localStorage.setItem('local_cart', JSON.stringify(localCart));
      toast.success(`Added ${quantity} ${product.unit}(s) to cart`);
      return;
    }
    
    // User is logged in - add to database cart
    addToCart(product.id, quantity);
    toast.success(`Added ${quantity} ${product.unit}(s) to cart`);
  };

  const handleOrderNow = async () => {
    if (!product) return;
    
    // Always add to cart first (whether logged in or not)
    if (!user) {
      // Add to local cart if not logged in
      const localCart = JSON.parse(localStorage.getItem('local_cart') || '[]');
      const existingItem = localCart.find((item: any) => item.product_id === product.id);
      
      // Get first image
      const imageUrl = images && images.length > 0 ? images[0] : '';
      
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        localCart.push({
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: quantity,
          unit: product.unit,
          image_url: imageUrl,
          category: product.category || ''
        });
      }
      
      localStorage.setItem('local_cart', JSON.stringify(localCart));
      toast.success(`Added ${quantity} ${product.unit}(s) to cart`);
    } else {
      // Add to database cart if logged in
      await addToCart(product.id, quantity);
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
          🎯 Viewing Product from Advertisement
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
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  {product.vendor_profiles.location}
                </div>
                {product.average_rating && product.average_rating > 0 ? (
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                    <span className="font-medium text-gray-900">
                      {product.average_rating.toFixed(1)}
                    </span>
                    {product.total_ratings && product.total_ratings > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({product.total_ratings})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-gray-300" />
                    <span className="text-xs text-gray-500">No ratings yet</span>
                  </div>
                )}
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
              </CardContent>
            </Card>

            {/* Quantity Selector */}
            <div className="flex items-center gap-3">
              <label className="font-medium text-sm">Quantity:</label>
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
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
        <div className="mt-6 sm:mt-8 w-full -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <ProductRatings 
              productId={product.id} 
              vendorUserId={product.vendor_profiles?.user_id}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProductDetails;



import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ShoppingCart, Star, MapPin, Plus, X } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import ChatButton from '../components/ChatButton';

const Products = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedProductId = searchParams.get('product');
  const productRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [sortBy, setSortBy] = useState('newest');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState<{ name: string; description: string } | null>(null);
  const [advertisements, setAdvertisements] = useState<any[]>([]);
  const [visibleAds, setVisibleAds] = useState<Set<string>>(new Set());
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const adRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { addToCart, loading: cartLoading } = useCart();
  const { user } = useAuth();
  
  // Scroll animation refs
  const productsGridRef = useRef<HTMLDivElement>(null);
  
  // Get products first
  const { data: allProducts = [], isLoading, error } = useProducts(
    searchTerm || undefined,
    selectedCategory,
    selectedLocation
  );
  
  // Apply client-side filters (price & rating)
  const products = allProducts.filter(p => {
    const minPriceNum = minPrice ? parseFloat(minPrice) : 0;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : Infinity;
    const minRatingNum = parseFloat(minRating);
    
    const priceMatch = p.price >= minPriceNum && p.price <= maxPriceNum;
    const ratingMatch = (p.average_rating || 0) >= minRatingNum;
    const stockMatch = !inStockOnly || (p.stock_quantity && p.stock_quantity > 0);
    const vendorMatch = selectedVendor === 'all' || p.vendor_profiles?.farm_name === selectedVendor;
    
    return priceMatch && ratingMatch && stockMatch && vendorMatch;
  }).sort((a, b) => {
    switch(sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return (b.average_rating || 0) - (a.average_rating || 0);
      case 'newest':
      default:
        return 0; // Keep original order (assuming API returns newest first)
    }
  });
  
  // Get unique vendors
  const vendors = Array.from(new Set(allProducts.map(p => p.vendor_profiles?.farm_name).filter(Boolean)));
  
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
    return () => {
      if (adRotationIntervalRef.current) {
        clearInterval(adRotationIntervalRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    setupScrollAnimations();
  }, [products.length, searchTerm, selectedCategory, selectedLocation]);
  
  const setupScrollAnimations = () => {
    const observerOptions = {
      threshold: 0.05,
      rootMargin: '0px 0px -30px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          entry.target.classList.remove('animate-out');
        } else {
          // Reset animation when element leaves viewport - allows re-animation on scroll
          entry.target.classList.remove('animate-in');
          entry.target.classList.add('animate-out');
        }
      });
    }, observerOptions);
    
    // Observe all product cards - lightweight and fast - animations trigger every scroll
    setTimeout(() => {
      const productCards = document.querySelectorAll('.product-card');
      productCards.forEach((card) => observer.observe(card));
    }, 50);
  };

  const fetchAdvertisements = async () => {
    try {
      const response = await fetch(getApiUrl('/api/advertisements?limit=10&page_location=products'));
      const data = await response.json();
      if (Array.isArray(data)) {
        setAdvertisements(data);
        // Show first premium ad or first ad if no premium
        const premiumAds = data.filter((ad: any) => ad.tier === 'premium');
        const firstAd = premiumAds.length > 0 ? premiumAds[0] : data[0];
        if (firstAd) {
          setVisibleAds(new Set([firstAd.id]));
          setCurrentAdIndex(0);
          
          // Start rotation if there are multiple ads
          if (data.length > 1) {
            startAdRotation(data);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch advertisements:', error);
    }
  };

  const startAdRotation = (ads: any[]) => {
    // Clear any existing interval
    if (adRotationIntervalRef.current) {
      clearInterval(adRotationIntervalRef.current);
    }

    // Rotate ads based on their content_duration for fairness
    // Each ad gets equal time based on its configured duration (default 30 seconds)
    const rotateToNext = () => {
      setCurrentAdIndex((prevIndex) => {
        const currentAd = ads[prevIndex];
        const duration = currentAd?.content_duration ? currentAd.content_duration * 1000 : 30000; // Convert to ms, default 30s
        
        // Schedule next rotation based on current ad's duration
        if (adRotationIntervalRef.current) {
          clearInterval(adRotationIntervalRef.current);
        }
        
        adRotationIntervalRef.current = setTimeout(() => {
          const nextIndex = (prevIndex + 1) % ads.length;
          const nextAd = ads[nextIndex];
          setVisibleAds(new Set([nextAd.id]));
          setCurrentAdIndex(nextIndex);
          rotateToNext(); // Continue rotation
        }, duration);
        
        return prevIndex;
      });
    };

    // Start rotation with first ad's duration
    const firstAd = ads[0];
    const firstDuration = firstAd?.content_duration ? firstAd.content_duration * 1000 : 30000;
    adRotationIntervalRef.current = setTimeout(() => {
      const nextIndex = 1 % ads.length;
      const nextAd = ads[nextIndex];
      setVisibleAds(new Set([nextAd.id]));
      setCurrentAdIndex(nextIndex);
      rotateToNext();
    }, firstDuration);
  };

  const handleAdClose = (adId: string) => {
    setVisibleAds(prev => {
      const newSet = new Set(prev);
      newSet.delete(adId);
      
      // If no ads visible, show next ad
      if (newSet.size === 0 && advertisements.length > 0) {
        const nextIndex = (currentAdIndex + 1) % advertisements.length;
        const nextAd = advertisements[nextIndex];
        newSet.add(nextAd.id);
        setCurrentAdIndex(nextIndex);
      }
      
      return newSet;
    });
  };

  // Scroll to and highlight product when product query parameter is present (from ad click)
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

        // Remove product param from URL after highlighting to prevent persistence on reload
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('product');
        const newSearch = newSearchParams.toString();
        navigate(`/products${newSearch ? `?${newSearch}` : ''}`, { replace: true });
      }
    }
  }, [highlightedProductId, products, searchParams, navigate]);

  const handleAddToCart = async (productId: string) => {
    // Allow adding to cart without login - save to local storage
    if (!user) {
      // Save to local storage cart
      const localCart = JSON.parse(localStorage.getItem('local_cart') || '[]');
      const product = products.find(p => p.id === productId);
      
      if (product) {
        const existingItem = localCart.find((item: any) => item.product_id === productId);
        
        // Get first image from image_urls array or use image_url
        let imageUrl: string | null = null;
        const imgsAny: any = (product as any).image_urls ?? product.image_urls;
        if (imgsAny && Array.isArray(imgsAny) && imgsAny.length > 0) {
          imageUrl = imgsAny[0];
        } else if (typeof imgsAny === 'string') {
          try {
            const parsed = JSON.parse(imgsAny);
            imageUrl = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
          } catch (e) {
            imageUrl = imgsAny;
          }
        } else if (product.image_url) {
          imageUrl = product.image_url as string;
        }
        
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          localCart.push({
            product_id: productId,
            product_name: product.name,
            price: product.price,
            quantity: 1,
            unit: product.unit,
            image_url: imageUrl,
            category: product.category || ''
          });
        }
        
        localStorage.setItem('local_cart', JSON.stringify(localCart));
        toast.success(`${product.name} added to cart`);
      }
      return;
    }
    
    // User is logged in - add to database cart
    await addToCart(productId, 1); // Context handles toasts
  };

  // Get unique locations from products
  const locations: string[] = ['all', ...Array.from(new Set(products.map(p => p.vendor_profiles.location)))];

  const handleOrderNow = async (product: any) => {
    // Always add to cart first (whether logged in or not)
    if (!user) {
      // Add to local cart if not logged in
      const localCart = JSON.parse(localStorage.getItem('local_cart') || '[]');
      const existingItem = localCart.find((item: any) => item.product_id === product.id);
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        localCart.push({
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: 1,
          unit: product.unit,
          image_url: product.image_url,
          category: product.category
        });
      }
      
      localStorage.setItem('local_cart', JSON.stringify(localCart));
      toast.success(`${product.name} added to cart`);
    } else {
      // Add to database cart if logged in
      await addToCart(product.id, 1);
    }
    
    // Navigate to checkout page with all cart items
    navigate('/checkout');
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
      {hasPremiumAd && <div style={{ height: '90px' }} />}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Browse Products</h1>
            <p className="text-gray-600">Find quality poultry products from trusted farmers across Kenya</p>
          </div>

          {/* Advertisements - Floating Overlays (Premium: top banner, Basic: bottom-right popup) */}
          {/* Show only one ad at a time with rotation */}
          {advertisements.length > 0 && advertisements
            .filter(ad => visibleAds.has(ad.id))
            .map((ad) => (
              <AdvertisementBanner
                key={ad.id}
                advertisement={ad}
                onClose={() => handleAdClose(ad.id)}
                pageLocation="products"
              />
            ))}

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

              <Button 
                variant="outline" 
                className="flex items-center"
                onClick={() => setShowMoreFilters(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          {/* Advanced Filters Modal */}
          {showMoreFilters && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setShowMoreFilters(false)}
            >
              <Card className="w-full sm:max-w-md animate-in zoom-in-95 duration-200 rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto sm:max-h-[95vh] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="sticky top-0 bg-white dark:bg-gray-800 border-b flex justify-between items-center px-4 sm:px-6 py-4">
                  <CardTitle className="text-lg sm:text-xl font-bold text-gray-900">Advanced Filters</CardTitle>
                  <button
                    onClick={() => setShowMoreFilters(false)}
                    className="flex-shrink-0 ml-4 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors duration-150"
                    aria-label="Close filters"
                    title="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                  {/* Sort By */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="price-low">Price: Low to High</SelectItem>
                        <SelectItem value="price-high">Price: High to Low</SelectItem>
                        <SelectItem value="rating">Best Rated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stock Availability */}
                  <div>
                    <label htmlFor="in-stock-only" className="flex items-center gap-3 cursor-pointer">
                      <input
                        id="in-stock-only"
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        aria-label="Show only products in stock"
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs sm:text-sm font-medium text-gray-700">In Stock Only</span>
                    </label>
                  </div>

                  {/* Vendor Filter */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Vendor/Farm</label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {vendors.map(vendor => (
                          <SelectItem key={vendor} value={vendor || 'Unknown'}>
                            {vendor || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Price Range (KSH)</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min price"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="w-1/2 text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Max price"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="w-1/2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Rating Filter */}
                  <div>
                    <label htmlFor="min-rating-slider" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Minimum Rating</label>
                    <div className="flex gap-2 items-center">
                      <input
                        id="min-rating-slider"
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        value={minRating}
                        onChange={(e) => setMinRating(e.target.value)}
                        className="flex-1"
                        aria-label="Minimum rating filter"
                        title={`Minimum rating: ${minRating} stars`}
                      />
                      <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                        {minRating} <Star className="h-3 w-3 sm:h-4 sm:w-4 inline text-yellow-400 fill-yellow-400" />
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 sm:gap-3 pt-4 sm:pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMinPrice('');
                        setMaxPrice('');
                        setMinRating('0');
                        setSortBy('newest');
                        setInStockOnly(false);
                        setSelectedVendor('all');
                      }}
                      className="flex-1 text-xs sm:text-sm"
                    >
                      Reset All
                    </Button>
                    <Button
                      onClick={() => setShowMoreFilters(false)}
                      className="flex-1 btn-primary text-xs sm:text-sm"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading products...</p>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && (
            <div ref={productsGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product, index) => {
                const isHighlighted = highlightedProductId === product.id;
                // Vary animation directions: 0=up, 1=left, 2=right, 3=down
                const direction = index % 4;
                const directionClasses = {
                  0: 'opacity-0 translate-y-8', // up
                  1: 'opacity-0 -translate-x-8', // left
                  2: 'opacity-0 translate-x-8', // right
                  3: 'opacity-0 translate-y-8' // up (alternate)
                };
                return (
                <Card 
                  key={product.id} 
                  ref={(el) => { productRefs.current[product.id] = el; }}
                  className={`product-card card-hover overflow-hidden transition-all duration-300 ease-out animate-out cursor-pointer ${directionClasses[direction as keyof typeof directionClasses]} ${
                    isHighlighted 
                      ? 'ring-4 ring-yellow-400 ring-offset-4 shadow-2xl scale-105 z-10 border-4 border-yellow-400' 
                      : ''
                  }`}
                  style={{
                    animation: isHighlighted ? 'pulse 2s ease-in-out' : undefined,
                    transitionDelay: `${(index % 6) * 30}ms` // Very fast stagger for products
                  }}
                  onClick={() => {
                    // Navigate to product details page
                    navigate(`/product/${product.id}`);
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
                        // Prefer explicit `image_urls` when present, otherwise fall back to `image_url` which may be a URL or JSON-stringified array
                        const imgs: any = (product as any).image_urls ?? product.image_urls;
                        if (imgs && Array.isArray(imgs) && imgs.length > 0) {
                          return getImageUrl(String(imgs[0]).replace(/\\/g, '/'));
                        }
                        if (typeof imgs === 'string') {
                          try {
                            const parsed = JSON.parse(imgs);
                            if (Array.isArray(parsed) && parsed.length > 0) return getImageUrl(String(parsed[0]).replace(/\\/g, '/'));
                          } catch (e) {
                            // fallthrough
                          }
                        }
                        const fallback = product.image_url || 'https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp?a=1&b=1&s=612x612&w=0&k=20&c=W6Cdm-2XcJOXfmNgYIxYVLQ0DEnDDgsSt1O-EemeYUc?w=800';
                        return getImageUrl(String(fallback));
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
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click
                            handleViewDescription(product);
                          }}
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
                      {product.average_rating && product.average_rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {product.average_rating.toFixed(1)}
                          </span>
                          {product.total_ratings && product.total_ratings > 0 && (
                            <span className="text-xs text-gray-500">
                              ({product.total_ratings})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-gray-300" />
                          <span className="text-xs text-gray-400">No ratings</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">by {product.vendor_profiles.farm_name}</p>
                        <p className="text-lg font-bold text-primary">
                          KSH {product.price.toLocaleString()} / {product.unit}
                        </p>
                        <p className="text-xs text-gray-500">Stock: {product.stock_quantity} {product.unit}s</p>
                      </div>
                      <div className="flex flex-col gap-3 w-44">
                        {/* Purchase actions grouped together */}
                        <div className="flex flex-col gap-2">
                          <Button
                            className="bg-primary text-white hover:bg-primary/95 flex items-center justify-center w-full h-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product.id);
                            }}
                            disabled={cartLoading || product.stock_quantity <= 0}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>

                          <Button
                            variant="outline"
                            className="flex items-center justify-center w-full h-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOrderNow(product);
                            }}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Order Now
                          </Button>
                        </div>

                        {/* Chat placed separately with visual separation to reduce mis-clicks */}
                        <div className="pt-1 border-t -mx-2 px-2">
                          <ChatButton
                            productId={product.id}
                            vendorId={product.vendor_id}
                            vendorUserId={product.vendor_profiles?.user_id || product.vendor_user_id}
                            className="w-full h-10 text-sm"
                          />
                        </div>
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

    </div>
  );
};

export default Products;

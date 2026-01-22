
import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ShoppingCart, Star, MapPin, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [sortBy, setSortBy] = useState('newest');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [expandedSections, setExpandedSections] = useState({
    quickFilters: true,
    searchCategory: true
  });
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState<{ name: string; description: string } | null>(null);
  const [advertisements, setAdvertisements] = useState<any[]>([]);
  const [visibleAds, setVisibleAds] = useState<Set<string>>(new Set());
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const adRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { addToCart, loading: cartLoading } = useCart();
  const { user } = useAuth();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // URL parameter persistence
  useEffect(() => {
    // Read initial filter values from URL parameters
    const urlParams = new URLSearchParams(searchParams);

    const search = urlParams.get('search') || '';
    const category = urlParams.get('category') || 'all';
    const location = urlParams.get('location') || 'all';
    const minPriceParam = urlParams.get('minPrice') || '';
    const maxPriceParam = urlParams.get('maxPrice') || '';
    const minRatingParam = urlParams.get('minRating') || '0';
    const sortByParam = urlParams.get('sortBy') || 'newest';
    const inStockOnlyParam = urlParams.get('inStockOnly') === 'true';
    const vendorParam = urlParams.get('vendor') || 'all';

    setSearchTerm(search);
    setDebouncedSearchTerm(search); // Set both to prevent delay on initial load
    setSelectedCategory(category);
    setSelectedLocation(location);
    setMinPrice(minPriceParam);
    setMaxPrice(maxPriceParam);
    setMinRating(minRatingParam);
    setSortBy(sortByParam);
    setInStockOnly(inStockOnlyParam);
    setSelectedVendor(vendorParam);
  }, []); // Only run on mount

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (searchTerm) params.set('search', searchTerm);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedLocation !== 'all') params.set('location', selectedLocation);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minRating !== '0') params.set('minRating', minRating);
    if (sortBy !== 'newest') params.set('sortBy', sortBy);
    if (inStockOnly) params.set('inStockOnly', 'true');
    if (selectedVendor !== 'all') params.set('vendor', selectedVendor);

    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;

    // Only update URL if it actually changed
    if (window.location.search !== `?${newSearch}`) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [debouncedSearchTerm, selectedCategory, selectedLocation, minPrice, maxPrice, minRating, sortBy, inStockOnly, selectedVendor]);
  
  // Scroll animation refs
  const productsGridRef = useRef<HTMLDivElement>(null);
  
  // Get products first
  const { data: allProducts = [], isLoading, error } = useProducts(
    debouncedSearchTerm || undefined,
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

  // Calculate result counts for filter options
  const getCategoryCount = (category: string) => {
    return allProducts.filter(p => category === 'all' || p.category === category).length;
  };

  const getLocationCount = (location: string) => {
    return allProducts.filter(p => location === 'all' || p.vendor_profiles?.location === location).length;
  };

  const getVendorCount = (vendor: string) => {
    return allProducts.filter(p => vendor === 'all' || p.vendor_profiles?.farm_name === vendor).length;
  };
  
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
          <div className="bg-white rounded-lg shadow-md mb-8 overflow-hidden">
            {/* Search & Category Section */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, searchCategory: !prev.searchCategory }))}
                className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                aria-expanded={expandedSections.searchCategory}
                aria-controls="search-category-section"
              >
                <h3 className="font-semibold text-gray-900">Search & Categories</h3>
                {expandedSections.searchCategory ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {expandedSections.searchCategory && (
                <div id="search-category-section" className="px-4 sm:px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Search products or vendors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        aria-label="Search products"
                      />
                    </div>

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger aria-label={`Product category filter, ${selectedCategory === 'all' ? 'showing all categories' : `filtered to ${selectedCategory}`}`}>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories ({allProducts.length})</SelectItem>
                        <SelectItem value="chicks">Chicks ({getCategoryCount('chicks')})</SelectItem>
                        <SelectItem value="eggs">Eggs ({getCategoryCount('eggs')})</SelectItem>
                        <SelectItem value="chickens">Chickens ({getCategoryCount('chickens')})</SelectItem>
                        <SelectItem value="feed">Feed ({getCategoryCount('feed')})</SelectItem>
                        <SelectItem value="equipment">Equipment ({getCategoryCount('equipment')})</SelectItem>
                        <SelectItem value="medicine">Medicine ({getCategoryCount('medicine')})</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger aria-label={`Location filter, ${selectedLocation === 'all' ? 'showing all locations' : `filtered to ${selectedLocation}`}`}>
                        <SelectValue placeholder="All Locations" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(location => (
                          <SelectItem key={location} value={location}>
                            {location === 'all' ? `All Locations (${allProducts.length})` : `${location} (${getLocationCount(location)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Filters Section */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, quickFilters: !prev.quickFilters }))}
                className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                aria-expanded={expandedSections.quickFilters}
                aria-controls="quick-filters-section"
              >
                <h3 className="font-semibold text-gray-900">Quick Filters</h3>
                {expandedSections.quickFilters ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {expandedSections.quickFilters && (
                <div id="quick-filters-section" className="px-4 sm:px-6 pb-4">
                  <div className="space-y-4">
                    {/* Price Range Quick Select */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Button
                          variant={minPrice === '' && maxPrice === '100' ? "default" : "outline"}
                          size="sm"
                          onClick={() => { setMinPrice(''); setMaxPrice('100'); }}
                          className="text-xs h-8"
                        >
                          Under 100 KSH
                        </Button>
                        <Button
                          variant={minPrice === '100' && maxPrice === '500' ? "default" : "outline"}
                          size="sm"
                          onClick={() => { setMinPrice('100'); setMaxPrice('500'); }}
                          className="text-xs h-8"
                        >
                          100-500 KSH
                        </Button>
                        <Button
                          variant={minPrice === '500' && maxPrice === '' ? "default" : "outline"}
                          size="sm"
                          onClick={() => { setMinPrice('500'); setMaxPrice(''); }}
                          className="text-xs h-8"
                        >
                          500+ KSH
                        </Button>
                      </div>
                    </div>

                    {/* Rating & Availability */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rating & Availability</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          variant={minRating === '4' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMinRating(minRating === '4' ? '0' : '4')}
                          className="text-xs h-8"
                        >
                          4+ ⭐ Rating
                        </Button>
                        <Button
                          variant={inStockOnly ? "default" : "outline"}
                          size="sm"
                          onClick={() => setInStockOnly(!inStockOnly)}
                          className="text-xs h-8"
                        >
                          In Stock Only
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Actions */}
            <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row gap-3">
                {(() => {
                  const advancedFilterCount = [
                    sortBy !== 'newest',
                    selectedVendor !== 'all',
                    minPrice || maxPrice,
                    minRating !== '0'
                  ].filter(Boolean).length;

                  const hasAnyFilters = searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all' ||
                                       minPrice || maxPrice || minRating !== '0' || inStockOnly;

                  return (
                    <>
                      <Button
                        variant="outline"
                        className="flex items-center justify-center sm:flex-1 h-10"
                        onClick={() => setShowMoreFilters(true)}
                        aria-label={`Advanced filters ${advancedFilterCount > 0 ? `(${advancedFilterCount} active)` : ''}`}
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Advanced Filters
                        {advancedFilterCount > 0 && (
                          <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary text-white">
                            {advancedFilterCount}
                          </Badge>
                        )}
                      </Button>

                      {hasAnyFilters && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedCategory('all');
                            setSelectedLocation('all');
                            setMinPrice('');
                            setMaxPrice('');
                            setMinRating('0');
                            setInStockOnly(false);
                          }}
                          className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 h-10 sm:w-auto"
                          aria-label="Clear all filters"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear All
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(() => {
            const activeFilters = [];

            if (searchTerm) activeFilters.push({ type: 'search', label: `Search: "${searchTerm}"`, clear: () => setSearchTerm('') });
            if (selectedCategory !== 'all') activeFilters.push({ type: 'category', label: `Category: ${selectedCategory}`, clear: () => setSelectedCategory('all') });
            if (selectedLocation !== 'all') activeFilters.push({ type: 'location', label: `Location: ${selectedLocation}`, clear: () => setSelectedLocation('all') });
            if (minPrice || maxPrice) activeFilters.push({ type: 'price', label: `Price: ${minPrice || '0'} - ${maxPrice || '∞'} KSH`, clear: () => { setMinPrice(''); setMaxPrice(''); } });
            if (minRating !== '0') activeFilters.push({ type: 'rating', label: `Rating: ${minRating}+ stars`, clear: () => setMinRating('0') });
            if (sortBy !== 'newest') activeFilters.push({ type: 'sort', label: `Sort: ${sortBy === 'price-low' ? 'Low to High' : sortBy === 'price-high' ? 'High to Low' : sortBy === 'rating' ? 'Best Rated' : 'Newest'}`, clear: () => setSortBy('newest') });
            if (inStockOnly) activeFilters.push({ type: 'stock', label: 'In Stock Only', clear: () => setInStockOnly(false) });
            if (selectedVendor !== 'all') activeFilters.push({ type: 'vendor', label: `Vendor: ${selectedVendor}`, clear: () => setSelectedVendor('all') });

            return activeFilters.length > 0 && (
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md mb-6">
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Active Filters:</span>
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    {activeFilters.map((filter, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1 px-2 sm:px-3 py-1 text-xs">
                        <span className="truncate max-w-24 sm:max-w-none">{filter.label}</span>
                        <button
                          onClick={filter.clear}
                          className="ml-1 hover:bg-gray-300 rounded-full p-0.5 transition-colors flex-shrink-0"
                          aria-label={`Remove ${filter.label} filter`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                      setSelectedLocation('all');
                      setMinPrice('');
                      setMaxPrice('');
                      setMinRating('0');
                      setSortBy('newest');
                      setInStockOnly(false);
                      setSelectedVendor('all');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap mt-1 sm:mt-0"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Advanced Filters Modal */}
          {showMoreFilters && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setShowMoreFilters(false)}
            >
              <Card className="w-full sm:max-w-md animate-in zoom-in-95 duration-200 rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto sm:max-h-[95vh] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="sticky top-0 bg-white dark:bg-gray-800 border-b flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-3">
                    <Filter className="h-5 w-5 text-gray-600" />
                    <CardTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Advanced Filters</CardTitle>
                  </div>
                  <button
                    onClick={() => setShowMoreFilters(false)}
                    className="flex-shrink-0 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors duration-150 touch-manipulation"
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
                        <SelectItem value="all">All Vendors ({allProducts.length})</SelectItem>
                        {vendors.map(vendor => (
                          <SelectItem key={vendor} value={vendor || 'Unknown'}>
                            {vendor || 'Unknown'} ({getVendorCount(vendor)})
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
                  <div className="flex gap-3 sm:gap-3 pt-6 sm:pt-4 sticky bottom-0 bg-white dark:bg-gray-800 border-t mt-6 -mb-6 -mx-4 px-4 py-4 sm:relative sm:bg-transparent sm:border-t-0 sm:mt-0 sm:-mb-0 sm:-mx-0 sm:px-0 sm:py-0">
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
                      className="flex-1 h-12 sm:h-10 text-sm sm:text-sm touch-manipulation font-medium"
                    >
                      Reset All
                    </Button>
                    <Button
                      onClick={() => setShowMoreFilters(false)}
                      className="flex-1 h-12 sm:h-10 btn-primary text-sm sm:text-sm touch-manipulation font-medium"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Screen Reader Announcements */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {products.length === 1 ? '1 product found' : `${products.length} products found`}
            {searchTerm && ` matching "${searchTerm}"`}
            {selectedCategory !== 'all' && ` in ${selectedCategory} category`}
            {selectedLocation !== 'all' && ` from ${selectedLocation}`}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12" aria-label="Loading products">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" aria-hidden="true"></div>
              <p className="text-gray-500 mt-4">Loading products...</p>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && (
            <div ref={productsGridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
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
                  <div className="relative h-36 md:h-40">
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
                    <div className="absolute top-1 right-1 bg-accent text-black px-1.5 py-0.5 rounded text-xs font-medium">
                      KSH {product.price.toLocaleString()}
                    </div>
                  </div>
                  
                  <CardContent className="p-2 md:p-3">
                    <h3 className="font-semibold text-sm md:text-base text-primary mb-1 line-clamp-2">{product.name}</h3>
                    <div className="mb-2 hidden md:block">
                      <div className="text-gray-600 text-xs line-clamp-1">
                        {product.description}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center text-xs text-gray-500">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span className="truncate">{product.vendor_profiles.location}</span>
                      </div>
                      {product.average_rating && product.average_rating > 0 ? (
                        <div className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-medium">
                            {product.average_rating.toFixed(1)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 truncate">by {product.vendor_profiles.farm_name}</p>
                        <p className="text-sm md:text-base font-bold text-primary">
                          KSH {product.price.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">Stock: {product.stock_quantity}</p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Button
                          size="sm"
                          className="bg-primary text-white hover:bg-primary/95 flex items-center justify-center w-full h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product.id);
                          }}
                          disabled={cartLoading || product.stock_quantity <= 0}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add to Cart
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center justify-center w-full h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderNow(product);
                          }}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Order Now
                        </Button>

                        <div className="hidden md:block">
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

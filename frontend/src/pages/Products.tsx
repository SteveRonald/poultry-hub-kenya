
import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Star, X, ChevronDown, ChevronUp, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { useProducts, Product } from '../hooks/useProducts';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getImageUrl } from '../config/api';
import AdvertisementBanner from '../components/AdvertisementBanner';
import ProductCard, { createCategoryPlaceholder } from '../components/ProductCard';
import { cn } from '../lib/utils';
import { useAdvertisementSlots } from '../hooks/useAdvertisementSlots';

const Products = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [expandedSections, setExpandedSections] = useState(() => ({
    quickFilters: false,
    searchCategory: typeof window !== 'undefined' ? window.innerWidth >= 640 : true
  }));
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState<{ name: string; description: string } | null>(null);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { advertisements, visibleAds, hasPremiumAd, handleAdClose } = useAdvertisementSlots('products', 20);

  const getVendorOptionValue = (vendorId?: string | number | null, vendorName?: string | null) => {
    if (!vendorId) return vendorName || 'Unknown';
    return `${vendorId}::${vendorName || 'Unknown'}`;
  };

  const getPublicVendorId = (product: Product) => {
    return String(
      product.vendor_id
      || (product.vendor_profiles as any)?.id
      || ''
    );
  };

  const parseVendorSelection = (value: string) => {
    if (!value || value === 'all') {
      return { vendorId: 'all', vendorName: 'all' };
    }

    if (value.includes('::')) {
      const [vendorId, ...nameParts] = value.split('::');
      return {
        vendorId: vendorId || 'all',
        vendorName: nameParts.join('::') || 'Unknown',
      };
    }

    return {
      vendorId: 'all',
      vendorName: value,
    };
  };

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
    const vendorIdParam = urlParams.get('vendorId');
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
    if (vendorIdParam) {
      setSelectedVendor(getVendorOptionValue(vendorIdParam, vendorParam === 'all' ? 'Vendor' : vendorParam));
    } else {
      setSelectedVendor(vendorParam);
    }
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
    const { vendorId, vendorName } = parseVendorSelection(selectedVendor);
    if (selectedVendor !== 'all') {
      if (vendorId !== 'all') {
        params.set('vendorId', vendorId);
        params.set('vendor', vendorName);
      } else {
        params.set('vendor', vendorName);
      }
    }

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
    const { vendorId, vendorName } = parseVendorSelection(selectedVendor);
    const vendorMatch = selectedVendor === 'all'
      || (vendorId !== 'all' && getPublicVendorId(p) === vendorId)
      || (vendorId === 'all' && p.vendor_profiles?.farm_name === vendorName);

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
  const vendors = Array.from(
    new Map(
      allProducts
        .filter((p) => p.vendor_profiles?.farm_name)
        .map((p) => [
          String(getPublicVendorId(p) || p.vendor_profiles?.farm_name),
          {
            id: getPublicVendorId(p),
            name: p.vendor_profiles?.farm_name || 'Unknown',
          },
        ])
    ).values()
  );

  // Calculate result counts for filter options
  const getCategoryCount = (category: string) => {
    return allProducts.filter(p => category === 'all' || p.category === category).length;
  };

  const getLocationCount = (location: string) => {
    return allProducts.filter(p => location === 'all' || p.vendor_profiles?.location === location).length;
  };

  const getVendorCount = (vendorValue: string) => {
    const { vendorId, vendorName } = parseVendorSelection(vendorValue);
    return allProducts.filter((p) => {
      if (vendorValue === 'all') return true;
      if (vendorId !== 'all') return getPublicVendorId(p) === vendorId;
      return p.vendor_profiles?.farm_name === vendorName;
    }).length;
  };
  
  const getProductCardImage = (product: Product) => {
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
    if (product.image_url) {
      return getImageUrl(String(product.image_url));
    }
    return createCategoryPlaceholder(product.category, product.name);
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
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const minQty = product.minimum_order_quantity || 1;
    
    // Allow adding to cart without login - save to local storage
    if (!user) {
      // Save to local storage cart
      const localCart = JSON.parse(localStorage.getItem('local_cart') || '[]');
      
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
        existingItem.quantity += minQty;
      } else {
        localCart.push({
          product_id: productId,
          product_name: product.name,
          price: product.price,
          quantity: minQty,
          unit: product.unit,
          image_url: imageUrl,
          category: product.category || ''
        });
      }
      
      localStorage.setItem('local_cart', JSON.stringify(localCart));
      toast.success(`${product.name} added to cart`);
      return;
    }
    
    // User is logged in - add to database cart
    await addToCart(productId, minQty); // Context handles toasts
  };

  // Get unique locations from products
  const locations: string[] = ['all', ...Array.from(new Set(products.map(p => p.vendor_profiles.location)))];

  const handleOrderNow = async (product: Product) => {
    await handleAddToCart(product.id);
    // Navigate to checkout page with all cart items
    navigate('/checkout');
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('0');
    setSortBy('newest');
    setInStockOnly(false);
    setSelectedVendor('all');
  };

  const resetAdvancedFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinRating('0');
    setSortBy('newest');
    setInStockOnly(false);
    setSelectedVendor('all');
  };

  const activeFilters: Array<{ type: string; label: string; clear: () => void }> = [];
  if (searchTerm) activeFilters.push({ type: 'search', label: `Search: "${searchTerm}"`, clear: () => setSearchTerm('') });
  if (selectedCategory !== 'all') activeFilters.push({ type: 'category', label: `Category: ${selectedCategory}`, clear: () => setSelectedCategory('all') });
  if (selectedLocation !== 'all') activeFilters.push({ type: 'location', label: `Location: ${selectedLocation}`, clear: () => setSelectedLocation('all') });
  if (minPrice || maxPrice) activeFilters.push({ type: 'price', label: `Price: ${minPrice || '0'} - ${maxPrice || '∞'} KSH`, clear: () => { setMinPrice(''); setMaxPrice(''); } });
  if (minRating !== '0') activeFilters.push({ type: 'rating', label: `Rating: ${minRating}+ stars`, clear: () => setMinRating('0') });
  if (sortBy !== 'newest') activeFilters.push({ type: 'sort', label: `Sort: ${sortBy === 'price-low' ? 'Low to High' : sortBy === 'price-high' ? 'High to Low' : sortBy === 'rating' ? 'Best Rated' : 'Newest'}`, clear: () => setSortBy('newest') });
  if (inStockOnly) activeFilters.push({ type: 'stock', label: 'In Stock Only', clear: () => setInStockOnly(false) });
  if (selectedVendor !== 'all') {
    const { vendorName } = parseVendorSelection(selectedVendor);
    activeFilters.push({ type: 'vendor', label: `Vendor: ${vendorName}`, clear: () => setSelectedVendor('all') });
  }

  const advancedFilterCount = [
    sortBy !== 'newest',
    selectedVendor !== 'all',
    minPrice || maxPrice,
    minRating !== '0',
    inStockOnly
  ].filter(Boolean).length;
  const hasAnyFilters = activeFilters.length > 0;
  const hasSearchIntent = Boolean(searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all');
  const resultSummary = products.length === 1 ? '1 product found' : `${products.length} products found`;
  const resultContext = hasSearchIntent ? `from ${allProducts.length} available listings` : 'across the marketplace';

  const quickPriceRanges = [
    { label: 'Under 100 KSH', min: '', max: '100' },
    { label: '100-500 KSH', min: '100', max: '500' },
    { label: '500+ KSH', min: '500', max: '' }
  ];


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
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Products</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

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
          <div className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 bg-stone-50/80 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
                  <span className="font-medium text-stone-900">{resultSummary}</span>
                  {hasAnyFilters && (
                    <Badge variant="secondary" className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                      {activeFilters.length} active
                    </Badge>
                  )}
                </div>
                {hasAnyFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAllFilters}
                    className="h-8 rounded-full px-3 text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  >
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="border-b border-stone-100 px-4 py-4 sm:hidden">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    type="text"
                    placeholder="Search products, vendors, or categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-12 rounded-xl border-stone-200 pl-10 text-base placeholder:text-stone-400 focus-visible:ring-green-600"
                    aria-label="Search products, vendors, or categories"
                  />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-11 rounded-xl border-stone-200 text-left text-sm" aria-label={`Product category filter, ${selectedCategory === 'all' ? 'showing all categories' : `filtered to ${selectedCategory}`}`}>
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

                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border-stone-200 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    onClick={() => setShowMoreFilters(true)}
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters
                    {advancedFilterCount > 0 && (
                      <Badge className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-[11px] text-white">
                        {advancedFilterCount}
                      </Badge>
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                  <span className="rounded-full bg-stone-100 px-3 py-1.5">
                    {selectedLocation === 'all' ? 'All locations' : selectedLocation}
                  </span>
                  <span className="rounded-full bg-stone-100 px-3 py-1.5">
                    {sortBy === 'newest' ? 'Newest First' : sortBy === 'price-low' ? 'Price Low to High' : sortBy === 'price-high' ? 'Price High to Low' : 'Best Rated'}
                  </span>
                </div>
              </div>
            </div>
            {/* Search & Category Section */}
            <div className="hidden border-b border-stone-100 sm:block">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, searchCategory: !prev.searchCategory }))}
                className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-stone-50 sm:px-6"
                aria-expanded={expandedSections.searchCategory}
                aria-controls="search-category-section"
              >
                <h3 className="font-semibold text-stone-900">Search & Categories</h3>
                {expandedSections.searchCategory ? (
                  <ChevronUp className="h-5 w-5 text-stone-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-stone-500" />
                )}
              </button>

              {expandedSections.searchCategory && (
                <div id="search-category-section" className="px-4 pb-5 sm:px-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <Input
                        type="text"
                        placeholder="Search products, vendors, or categories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-12 rounded-xl border-stone-200 pl-10 text-base placeholder:text-stone-400 focus-visible:ring-green-600"
                        aria-label="Search products, vendors, or categories"
                      />
                    </div>

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="h-12 rounded-xl border-stone-200 text-left" aria-label={`Product category filter, ${selectedCategory === 'all' ? 'showing all categories' : `filtered to ${selectedCategory}`}`}>
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

                    <div className="hidden sm:block">
                      <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger className="h-12 rounded-xl border-stone-200 text-left" aria-label={`Location filter, ${selectedLocation === 'all' ? 'showing all locations' : `filtered to ${selectedLocation}`}`}>
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

                    <div className="hidden sm:block">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-12 rounded-xl border-stone-200 bg-white text-sm">
                          <SelectValue placeholder="Sort products" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="price-low">Price Low to High</SelectItem>
                          <SelectItem value="price-high">Price High to Low</SelectItem>
                          <SelectItem value="rating">Best Rated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Filters Section */}
            <div className="border-b border-stone-100">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, quickFilters: !prev.quickFilters }))}
                className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-stone-50 sm:px-6"
                aria-expanded={expandedSections.quickFilters}
                aria-controls="quick-filters-section"
              >
                <h3 className="font-semibold text-stone-900">Quick Filters</h3>
                {expandedSections.quickFilters ? (
                  <ChevronUp className="h-5 w-5 text-stone-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-stone-500" />
                )}
              </button>

              {expandedSections.quickFilters && (
                <div id="quick-filters-section" className="px-4 pb-5 sm:px-6">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {quickPriceRanges.map((range) => {
                        const isActive = minPrice === range.min && maxPrice === range.max;
                        return (
                          <Button
                            key={range.label}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (isActive) {
                                setMinPrice('');
                                setMaxPrice('');
                                return;
                              }
                              setMinPrice(range.min);
                              setMaxPrice(range.max);
                            }}
                            className={cn(
                              'h-9 rounded-full border px-4 text-xs font-medium transition-all',
                              isActive
                                ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                            )}
                          >
                            {range.label}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMinRating(minRating === '4' ? '0' : '4')}
                        className={cn(
                          'h-9 rounded-full border px-4 text-xs font-medium transition-all',
                          minRating === '4'
                            ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        )}
                      >
                        4+ Rating
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInStockOnly(!inStockOnly)}
                        className={cn(
                          'h-9 rounded-full border px-4 text-xs font-medium transition-all',
                          inStockOnly
                            ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        )}
                      >
                        In Stock
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Actions */}
            <div className="border-t border-stone-100 bg-stone-50 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-stone-600">
                  <span className="font-medium text-stone-900">{resultSummary}</span>
                  <span className="hidden sm:inline"> across the marketplace</span>
                </div>

                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                  onClick={() => setShowMoreFilters(true)}
                  aria-label={`Advanced filters ${advancedFilterCount > 0 ? `(${advancedFilterCount} active)` : ''}`}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Advanced Filters
                  {advancedFilterCount > 0 && (
                    <Badge className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-[11px] text-white">
                      {advancedFilterCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeFilters.map((filter, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700"
                >
                  <span className="truncate max-w-[180px] sm:max-w-none">{filter.label}</span>
                  <button
                    onClick={filter.clear}
                    className="ml-1 rounded-full p-0.5 transition-colors hover:bg-stone-200"
                    aria-label={`Remove ${filter.label} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Advanced Filters Modal */}
          {showMoreFilters && (
            <div
              className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
              onClick={() => setShowMoreFilters(false)}
            >
              <Card className="animate-in zoom-in-95 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border-0 shadow-2xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 sm:py-4">
                  <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200 sm:hidden" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Filter className="h-5 w-5 text-gray-600" />
                      <div>
                        <CardTitle className="text-base font-bold text-gray-900 sm:text-lg">Advanced Filters</CardTitle>
                        <p className="mt-0.5 text-xs text-stone-500">Vendor, price, and detailed preferences</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMoreFilters(false)}
                      className="flex-shrink-0 rounded-full bg-stone-100 p-2.5 text-gray-600 transition-colors duration-150 hover:bg-stone-200 hover:text-gray-800 touch-manipulation"
                      aria-label="Close filters"
                      title="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-5 overflow-y-auto p-4 pb-24 sm:space-y-6 sm:p-6 sm:pb-6">
                  {/* Sort By */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-700 sm:mb-3 sm:text-sm">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-11 rounded-xl border-stone-200 text-sm">
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
                    <label htmlFor="in-stock-only" className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 cursor-pointer">
                      <input
                        id="in-stock-only"
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        aria-label="Show only products in stock"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-gray-700">In Stock Only</span>
                    </label>
                  </div>

                  {/* Vendor Filter */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-700 sm:mb-3 sm:text-sm">Vendor/Farm</label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger className="h-11 rounded-xl border-stone-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors ({allProducts.length})</SelectItem>
                        {vendors.map((vendor) => {
                          const vendorValue = getVendorOptionValue(vendor.id, vendor.name);
                          return (
                          <SelectItem key={vendorValue} value={vendorValue}>
                            {vendor.name || 'Unknown'} ({getVendorCount(vendorValue)})
                          </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location Filter */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-700 sm:mb-3 sm:text-sm">Location</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="h-11 rounded-xl border-stone-200 text-sm">
                        <SelectValue />
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

                  {/* Price Range */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-700 sm:mb-3 sm:text-sm">Price Range (KSH)</label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        type="number"
                        placeholder="Min price"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="h-11 rounded-xl border-stone-200 text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Max price"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="h-11 rounded-xl border-stone-200 text-sm"
                      />
                    </div>
                  </div>

                  {/* Rating Filter */}
                  <div>
                    <label htmlFor="min-rating-slider" className="mb-2 block text-xs font-medium text-gray-700 sm:mb-3 sm:text-sm">Minimum Rating</label>
                    <div className="rounded-xl border border-stone-200 p-3">
                      <div className="flex items-center gap-3">
                        <input
                          id="min-rating-slider"
                          type="range"
                          min="0"
                          max="5"
                          step="0.5"
                          value={minRating}
                          onChange={(e) => setMinRating(e.target.value)}
                          className="flex-1 accent-green-600"
                          aria-label="Minimum rating filter"
                          title={`Minimum rating: ${minRating} stars`}
                        />
                        <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                          {minRating} <Star className="h-3 w-3 sm:h-4 sm:w-4 inline text-yellow-400 fill-yellow-400" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 border-t bg-white px-4 py-4 sm:static sm:m-0 sm:border-t-0 sm:bg-transparent sm:p-0">
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={resetAdvancedFilters}
                        className="h-12 flex-1 rounded-xl border-stone-300 text-sm font-medium touch-manipulation sm:h-10"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={() => setShowMoreFilters(false)}
                        className="h-12 flex-1 rounded-xl bg-green-600 text-sm font-medium text-white touch-manipulation hover:bg-green-700 sm:h-10"
                      >
                        Show Results
                      </Button>
                    </div>
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
            <div ref={productsGridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                <ProductCard
                  key={product.id}
                  product={product}
                  highlighted={isHighlighted}
                  imageSrc={getProductCardImage(product)}
                  animationClassName={`${directionClasses[direction as keyof typeof directionClasses]} animate-out`}
                  animationDelayMs={(index % 6) * 30}
                  cardRef={(el) => { productRefs.current[product.id] = el; }}
                  onCardClick={() => {
                    navigate(`/product/${product.id}`);
                  }}
                  onAddToCart={handleAddToCart}
                  onOrderNow={handleOrderNow}
                />
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

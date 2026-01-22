import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingCart, Eye } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { getApiUrl, getImageUrl } from '../config/api';

interface Product {
  id: string;
  name: string;
  price: number;
  product_image: string;
  vendor_profiles: {
    farm_name: string;
  };
}

const ProductCarousel: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch(getApiUrl('/api/products?limit=20'));
      const data = await response.json();
      if (data.success && data.products) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAutoScrolling || products.length === 0) return;

    autoScrollIntervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const scrollAmount = 300; // Scroll by 300px
        
        // Check if we've reached the end
        if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
          // Reset to start
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          // Scroll right
          container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      }
    }, 3000); // Auto-scroll every 3 seconds

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, [isAutoScrolling, products]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      const newScrollLeft = direction === 'left'
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;
      
      scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
      
      // Pause auto-scroll when user manually scrolls
      setIsAutoScrolling(false);
      setTimeout(() => setIsAutoScrolling(true), 5000); // Resume after 5 seconds
    }
  };

  if (loading) {
    return (
      <div className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-2">
              Featured Products
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Discover quality poultry products from trusted vendors
            </p>
          </div>
          <Link
            to="/products"
            className="hidden md:inline-flex items-center text-primary font-semibold hover:text-primary/80 transition-colors"
          >
            View All
            <ChevronRight className="ml-1 h-5 w-5" />
          </Link>
        </div>

        {/* Carousel Container */}
        <div className="relative group">
          {/* Left Arrow */}
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-6 w-6 text-primary" />
          </button>

          {/* Products Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseEnter={() => setIsAutoScrolling(false)}
            onMouseLeave={() => setIsAutoScrolling(true)}
          >
            {products.map((product) => (
              <Card
                key={product.id}
                className="flex-shrink-0 w-64 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group/card"
              >
                <Link to={`/product/${product.id}`}>
                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                    <img
                      src={getImageUrl(product.product_image)}
                      alt={product.name}
                      className="w-full h-full object-cover transform group-hover/card:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/card:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex gap-2">
                        <Button
                          size="sm"
                          className="bg-white text-primary hover:bg-gray-100"
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = `/product/${product.id}`;
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 bg-accent text-black px-2 py-1 rounded-full text-sm font-bold shadow-md">
                      KSH {product.price.toLocaleString()}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-base text-primary mb-1 line-clamp-2 min-h-[3rem]">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      by {product.vendor_profiles.farm_name}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>

          {/* Right Arrow */}
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-6 w-6 text-primary" />
          </button>
        </div>

        {/* Auto-scroll Indicator */}
        <div className="flex items-center justify-center mt-6 gap-2">
          <div className="flex gap-1">
            {[...Array(Math.min(5, Math.ceil(products.length / 4)))].map((_, idx) => (
              <div
                key={idx}
                className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {isAutoScrolling ? 'Auto-scrolling' : 'Paused'}
          </span>
        </div>

        {/* Mobile View All Button */}
        <div className="mt-6 text-center md:hidden">
          <Link
            to="/products"
            className="inline-flex items-center text-primary font-semibold hover:text-primary/80 transition-colors"
          >
            View All Products
            <ChevronRight className="ml-1 h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
};

export default ProductCarousel;

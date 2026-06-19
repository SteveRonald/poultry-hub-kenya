import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, ExternalLink } from 'lucide-react';
import { getApiUrl, getImageUrl } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import type { Advertisement } from '../hooks/useAdvertisementSlots';

interface AdvertisementBannerProps {
  advertisement: Advertisement;
  onClose?: () => void;
  pageLocation?: string;
}

const AdvertisementBanner: React.FC<AdvertisementBannerProps> = ({
  advertisement,
  onClose,
  pageLocation = 'homepage'
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [viewTracked, setViewTracked] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);
  const viewStartTime = useRef<number | null>(null);
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [sessionId] = useState(() => {
    // Get or create session ID
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  });

  // Get user ID from auth context if available
  const userId = localStorage.getItem('user_id') || null;
  const isFallbackAd = Boolean(advertisement.is_fallback);

  const getProductImages = () => {
    if (!advertisement.product_images) return [];

    try {
      const parsed = JSON.parse(advertisement.product_images);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  // Check if ad is video or static (for viewability tracking)
  const isVideo = advertisement.ad_image?.endsWith('.mp4') || 
                  advertisement.ad_image?.endsWith('.webm') || 
                  advertisement.ad_image?.endsWith('.mov');

  // Minimum viewable time: 2 seconds for video, 1 second for static (IAB/MRC standards)
  const minViewableTime = isVideo ? 2000 : 1000;

  // Calculate display duration based on tier
  const displayDuration = advertisement.tier === 'premium' 
    ? Math.min(advertisement.content_duration || 60, 60) 
    : Math.min(Math.max(advertisement.content_duration || 15, 15), 30);

  // Track viewability using Intersection Observer API (IAB/MRC compliant)
  useEffect(() => {
    if (!adRef.current || viewTracked || isFallbackAd) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Ad is at least 50% visible
            if (!viewStartTime.current) {
              viewStartTime.current = Date.now();
            }

            // Track view after minimum viewable time
            if (!viewTimerRef.current) {
              viewTimerRef.current = setTimeout(async () => {
                try {
                  await fetch(getApiUrl('/api/advertisements/track-view'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      advertisement_id: advertisement.id,
                      session_id: sessionId,
                      user_id: userId,
                      page_location: pageLocation
                    })
                  });
                  setViewTracked(true);
                } catch (error) {
                  console.error('Failed to track ad view:', error);
                }
              }, minViewableTime);
            }
          } else {
            // Ad is not visible, reset timer
            if (viewTimerRef.current) {
              clearTimeout(viewTimerRef.current);
              viewTimerRef.current = null;
            }
            viewStartTime.current = null;
          }
        });
      },
      {
        threshold: 0.5, // At least 50% of ad must be visible
        rootMargin: '0px'
      }
    );

    observer.observe(adRef.current);

    return () => {
      observer.disconnect();
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
    };
  }, [advertisement.id, sessionId, userId, pageLocation, minViewableTime, viewTracked, isFallbackAd]);

  // Auto-dismiss timer for basic tier ads only (premium ads should not auto-dismiss)
  useEffect(() => {
    if (advertisement.tier === 'basic' && isVisible) {
      setTimeRemaining(displayDuration);
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [advertisement.tier, displayDuration, isVisible]);

  // Respect dismissals for the current session so ads don't re-appear during rotation.
  useEffect(() => {
    const dismissed = sessionStorage.getItem(`dismissed_ad_${advertisement.id}`);
    if (dismissed === '1') {
      setIsVisible(false);
    }
  }, [advertisement.id]);

  const handleClose = () => {
    try {
      sessionStorage.setItem(`dismissed_ad_${advertisement.id}`, '1');
    } catch (e) {
      // ignore storage errors
    }
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (isFallbackAd) {
      navigate(advertisement.fallback_path || '/vendor-dashboard');
      return;
    }
    
    // Track click and get current product_id (handles product changes during reactivation)
    let currentProductId = advertisement.product_id;
    try {
      const response = await fetch(getApiUrl('/api/advertisements/track-click'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advertisement_id: advertisement.id,
          session_id: sessionId,
          user_id: userId
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Use the product_id returned from API (handles product changes during reactivation)
        if (data.product_id) {
          currentProductId = data.product_id;
        }
      }

      // Set cookie to track ad click for order attribution
      document.cookie = `ad_click=${advertisement.id}; path=/; max-age=${60 * 60 * 24}`; // 24 hours
    } catch (error) {
      console.error('Failed to track ad click:', error);
    }

    // Check if user is logged in
    if (!user) {
      // Store order context for after login/register
      const orderContext = {
        product_id: currentProductId,
        advertisement_id: advertisement.id,
        quantity: 1,
        source: 'advertisement',
        timestamp: Date.now()
      };
      sessionStorage.setItem('pending_order', JSON.stringify(orderContext));
      
      // Redirect to login with return URL to product details page
      navigate(`/login?redirect=/product/${currentProductId}&ad=${advertisement.id}`);
      return;
    }

    // User is logged in, navigate to product details page
    navigate(`/product/${currentProductId}?ad=${advertisement.id}`);
  };

  if (!isVisible) {
    return null;
  }

  // Get the raw image path
  const rawImagePath = advertisement.ad_image || 
    getProductImages()[0] ||
    '/placeholder.svg';
  
  // Convert to proper URL using getImageUrl helper (handles localhost to network IP conversion)
  let productImage = rawImagePath;
  if (rawImagePath && rawImagePath !== '/placeholder.svg') {
    productImage = getImageUrl(rawImagePath);
    
    // Debug logging for mobile
    if (import.meta.env.DEV) {
      console.log('AdvertisementBanner - Image URL conversion:', {
        raw: rawImagePath,
        converted: productImage,
        currentHost: window.location.hostname,
        currentPort: window.location.port
      });
    }
  }

  // Premium ads: Top fixed banner using Leaderboard standard (728×90 px)
  // Responsive: scales down on mobile while maintaining aspect ratio
  // Positioned below navbar (z-40) so navbar (z-50) stays on top
  if (advertisement.tier === 'premium') {
    return (
      <div
        ref={adRef}
        className="fixed top-16 sm:top-20 md:top-24 left-0 right-0 z-40 bg-gradient-to-r from-yellow-50 to-orange-50 border-b-2 border-yellow-400 shadow-lg transition-all duration-500 ease-in-out"
        style={{ 
          height: '90px',
          minHeight: '90px',
          transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: isVisible ? 1 : 0
        }}
      >
        <div className="w-full h-full max-w-[728px] mx-auto px-2 sm:px-4 relative">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            aria-label="Close advertisement"
            title="Close advertisement"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Timer */}
          {timeRemaining > 0 && (
            <div className="absolute top-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs">
              {timeRemaining}s
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-4 h-full">
            {/* Premium Badge */}
            <div className="bg-yellow-400 text-black px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold whitespace-nowrap flex-shrink-0">
              PREMIUM AD
            </div>

            {/* Ad Content */}
            <div
              onClick={handleClick}
              className="flex-1 flex items-center gap-2 sm:gap-4 h-full hover:opacity-90 transition-opacity min-w-0 cursor-pointer"
            >
              {/* Image - Standard Leaderboard aspect ratio (responsive) */}
              <div 
                className="rounded overflow-hidden flex-shrink-0"
                style={{
                  width: '120px',
                  height: '70px',
                  minWidth: '120px',
                  minHeight: '70px'
                }}
              >
                {(() => {
                  const isVideo = rawImagePath?.endsWith('.mp4') || 
                                 rawImagePath?.endsWith('.webm') || 
                                 rawImagePath?.endsWith('.mov') ||
                                 rawImagePath?.includes('video');
                  return isVideo ? (
                    <video
                      src={productImage}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onError={(e) => {
                        console.error('Video load error:', productImage, 'Original:', rawImagePath);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <img
                      src={productImage}
                      alt={advertisement.ad_title || advertisement.product_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Image load error:', productImage, 'Original:', rawImagePath);
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                      onLoad={() => {
                        if (import.meta.env.DEV) {
                          console.log('Ad image loaded successfully:', productImage);
                        }
                      }}
                    />
                  );
                })()}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                {advertisement.ad_title && (
                  <h3 className="font-semibold text-xs sm:text-sm md:text-base text-gray-900 truncate leading-tight">
                    {advertisement.ad_title}
                  </h3>
                )}
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 truncate leading-tight mt-0.5">
                  {advertisement.product_name}
                </p>
                <div className="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
                  {/* Price Display with Discount */}
                  <div className="flex flex-col">
                    {advertisement.previous_price && advertisement.current_price ? (
                      <>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="text-[10px] sm:text-xs text-gray-500 line-through">
                            KSh {advertisement.previous_price.toLocaleString()}
                          </span>
                          <span className="text-xs sm:text-sm md:text-base font-bold text-green-600">
                            KSh {advertisement.current_price.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[9px] sm:text-xs text-green-600 font-semibold">
                          Save KSh {(advertisement.previous_price - advertisement.current_price).toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs sm:text-sm md:text-base font-bold text-primary">
                        KSh {advertisement.product_price?.toLocaleString() || 'N/A'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs text-primary font-semibold flex items-center gap-1 bg-primary/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">
                    Order Now <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Basic ads: Bottom-right corner popup using Medium Rectangle standard (300×250 px)
  // Responsive: scales down on mobile while maintaining aspect ratio
  return (
    <div
      ref={adRef}
      className="ad-basic-popup fixed left-4 right-4 sm:left-auto sm:right-4 z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-300 overflow-hidden animate-slide-up"
      style={{ 
        bottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
        width: 'min(360px, calc(100vw - 2rem))',
        height: '250px',
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @media (max-width: 640px) {
          .ad-basic-popup {
            width: auto;
            height: auto;
            aspect-ratio: 300 / 250;
          }
        }
      `}</style>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
        aria-label="Close advertisement"
        title="Close advertisement"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Timer */}
      {timeRemaining > 0 && (
        <div className="absolute top-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs">
          {timeRemaining}s
        </div>
      )}

      {/* Advertisement Content - Medium Rectangle layout */}
      <div
        onClick={handleClick}
        className="block h-full cursor-pointer"
      >
        <div className="relative flex flex-col h-full">
          {/* Image - Top portion of rectangle */}
          <div 
            className="flex-shrink-0 overflow-hidden bg-gray-100"
            style={{
              height: '60%',
              minHeight: '150px'
            }}
          >
            {(() => {
              const isVideo = rawImagePath?.endsWith('.mp4') || 
                             rawImagePath?.endsWith('.webm') || 
                             rawImagePath?.endsWith('.mov') ||
                             rawImagePath?.includes('video');
              return isVideo ? (
                <video
                  src={productImage}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                  onError={(e) => {
                    console.error('Video load error:', productImage, 'Original:', rawImagePath);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <img
                  src={productImage}
                  alt={advertisement.ad_title || advertisement.product_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    console.error('AdvertisementBanner - Image load error:', {
                      productImage,
                      rawImagePath,
                      currentHost: window.location.hostname,
                      error: e
                    });
                    // Try fallback to product image if ad_image fails
                    if (rawImagePath === advertisement.ad_image && advertisement.product_images) {
                      const productImages = getProductImages();
                      if (productImages[0]) {
                        const fallbackUrl = getImageUrl(productImages[0]);
                        console.log('Trying fallback product image:', fallbackUrl);
                        (e.target as HTMLImageElement).src = fallbackUrl;
                        return;
                      }
                    }
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                  onLoad={() => {
                    if (import.meta.env.DEV) {
                      console.log('AdvertisementBanner - Image loaded successfully:', productImage);
                    }
                  }}
                />
              );
            })()}
          </div>

          {/* Content - Bottom portion of rectangle */}
          <div className="flex-1 p-3 flex flex-col justify-between min-w-0 bg-white">
            <div>
              {advertisement.ad_title && (
                <h3 className="font-semibold text-sm mb-1 text-gray-900 line-clamp-2 leading-tight">
                  {advertisement.ad_title}
                </h3>
              )}
              <p className="text-xs text-gray-700 mb-2 line-clamp-1 leading-tight">
                {advertisement.product_name}
              </p>
            </div>
            <div className="flex items-center justify-between mt-auto gap-2">
              {/* Price Display with Discount */}
              <div className="flex flex-col min-w-0">
                {advertisement.previous_price && advertisement.current_price ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-500 line-through">
                        KSh {advertisement.previous_price.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold text-green-600">
                        KSh {advertisement.current_price.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] text-green-600 font-semibold">
                      Save KSh {(advertisement.previous_price - advertisement.current_price).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-primary">
                    KSh {advertisement.product_price?.toLocaleString() || 'N/A'}
                  </span>
                )}
              </div>
              <span className="text-xs text-primary font-semibold flex items-center gap-1 bg-primary/10 px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                Order Now <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvertisementBanner;

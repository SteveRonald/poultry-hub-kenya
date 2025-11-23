
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, ShieldCheck, TrendingUp, Star, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import AdvertisementBanner from '../components/AdvertisementBanner';
import { getApiUrl } from '../config/api';

// Hero images for carousel - Balanced poultry-related images: Eggs, Live Chicken, Chicken Meat, Chicks, Poultry Farm, Poultry Feed
const heroImages = [
  {
    url: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=1200&h=800&auto=format&fit=crop&q=90",
    alt: "Fresh eggs in a bowl",
    objectPosition: "center center"
  },
  {
    url: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=1200&h=800&auto=format&fit=crop&q=90",
    alt: "Live chickens on a farm",
    objectPosition: "center center"
  },
  {
    url: "https://media.istockphoto.com/id/93456466/photo/raw-skin-on-chicken-legs-cross-each-other.webp?a=1&b=1&s=612x612&w=0&k=20&c=RwiA2ov5IuHI7OT8U01FJdGm88nxSt4wHpML7MGGTHY=",
    alt: "Fresh chicken meat products",
    objectPosition: "center center"
  },
  {
    url: "https://media.istockphoto.com/id/1383102145/photo/very-young-chicks-searching-for-food.webp?a=1&b=1&s=612x612&w=0&k=20&c=9xN1MbRcC521TmzbxZKcxuw74VPDJPINqoagee_Coyg=",
    alt: "Day old chicks",
    objectPosition: "center center"
  },
  {
    url: "https://media.istockphoto.com/id/2240911649/photo/large-indoor-poultry-farms.webp?a=1&b=1&s=612x612&w=0&k=20&c=NG8ZNXSbqgR93QPfRGrUJGgyW4pznmPmUe12qfof4y8=",
    alt: "Modern poultry farm",
    objectPosition: "center center"
  },
  {
    url: "https://images.unsplash.com/photo-1694854038360-56b29a16fb0c?w=1200&h=800&auto=format&fit=crop&q=90&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fFBvdWx0cnklMjBmZWVkJTIwYW5kJTIwbnV0cml0aW9ufGVufDB8fDB8fHww",
    alt: "Poultry feed and nutrition",
    objectPosition: "center center"
  }
];

const Index = () => {
  const { user } = useAuth();
  const [advertisements, setAdvertisements] = useState<any[]>([]);
  const [visibleAds, setVisibleAds] = useState<Set<string>>(new Set());
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const adRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Hero image carousel state
  const [currentHeroImageIndex, setCurrentHeroImageIndex] = useState(0);
  const heroImageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Scroll animation refs
  const heroTextRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAdvertisements();
    
    // Start hero image carousel
    heroImageIntervalRef.current = setInterval(() => {
      setCurrentHeroImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Change image every 5 seconds
    
    // Setup scroll animations
    setupScrollAnimations();
    
    return () => {
      if (adRotationIntervalRef.current) {
        clearInterval(adRotationIntervalRef.current);
      }
      if (heroImageIntervalRef.current) {
        clearInterval(heroImageIntervalRef.current);
      }
    };
  }, []);
  
  const setupScrollAnimations = () => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Add animate-in class to parent and all children with animate-out
          entry.target.classList.add('animate-in');
          entry.target.classList.remove('animate-out');
          
          // Find all children with animate-out class and animate them
          const children = entry.target.querySelectorAll('.animate-out');
          children.forEach((child, index) => {
            setTimeout(() => {
              child.classList.add('animate-in');
              child.classList.remove('animate-out');
            }, index * 50); // Stagger animation
          });
        } else {
          // Reset animation when element leaves viewport - allows re-animation on scroll
          entry.target.classList.remove('animate-in');
          entry.target.classList.add('animate-out');
        }
      });
    }, observerOptions);
    
    // Observe elements for scroll animations - animations trigger every time they enter viewport
    setTimeout(() => {
      if (heroTextRef.current) {
        observer.observe(heroTextRef.current);
        // Trigger initial animation for hero text
        setTimeout(() => {
          if (heroTextRef.current) {
            heroTextRef.current.classList.add('animate-in');
            heroTextRef.current.classList.remove('animate-out');
            const children = heroTextRef.current.querySelectorAll('.animate-in, .animate-out');
            children.forEach((child, index) => {
              setTimeout(() => {
                child.classList.add('animate-in');
                child.classList.remove('animate-out');
              }, index * 100);
            });
          }
        }, 300);
      }
      if (featuresRef.current) observer.observe(featuresRef.current);
      if (categoriesRef.current) observer.observe(categoriesRef.current);
      if (testimonialsRef.current) observer.observe(testimonialsRef.current);
      if (ctaRef.current) observer.observe(ctaRef.current);
    }, 100);
  };

  const fetchAdvertisements = async () => {
    try {
      const response = await fetch(getApiUrl('/api/advertisements?limit=10&page_location=homepage'));
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

  const features = [
    {
      icon: <Users className="h-8 w-8 text-accent" />,
      title: "Trusted Network",
      description: "Connect with verified poultry farmers and vendors across Kenya"
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-accent" />,
      title: "Quality Assured",
      description: "All products are verified with real photos and quality standards"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-accent" />,
      title: "Growing Community",
      description: "Join thousands of farmers and customers in our marketplace"
    }
  ];

  const categories = [
    {
      name: "Chicks",
      image: "https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp?a=1&b=1&s=612x612&w=0&k=20&c=W6Cdm-2XcJOXfmNgYIxYVLQ0DEnDDgsSt1O-EemeYUc=",
      description: "Quality day-old chicks from certified hatcheries"
    },
    {
      name: "Eggs",
      image: "https://media.istockphoto.com/id/2187046189/photo/group-of-fresh-brown-chicken-eggs-in-stack-in-wicker-basket-isolated-on-white-background-with.jpg?s=612x612&w=0&k=20&c=64XDmOVpFPnfeyehQ9iQ1mOBymFs2QE5yR-neC7QKfY=",
      description: "Fresh eggs from free-range and battery cage systems"
    },
    {
      name: "Poultry Meat",
      image: "https://media.istockphoto.com/id/164660922/photo/raw-turkey-meats-and-cuts.jpg?s=612x612&w=0&k=20&c=eGx-H4HC4rUM5illAZvhSXfanZZVZ5LOoYVFxW1jGMg=",
      description: "Premium chicken meat from trusted suppliers"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Wanjiku",
      role: "Poultry Farmer",
      content: "PoultryHubKenya (KE) has transformed my business. I can now reach customers directly without middlemen.",
      rating: 5
    },
    {
      name: "Steve Ronald",
      role: "Customer",
      content: "I always find quality chicks here. The farmers are reliable and the prices are fair.",
      rating: 5
    },
    {
      name: "Grace Akinyi",
      role: "Vendor",
      content: "The platform is easy to use and has helped me grow my poultry supply business significantly.",
      rating: 5
    }
  ];

  // Check if there's a premium ad (top banner) to add padding
  const hasPremiumAd = advertisements.some(ad => 
    visibleAds.has(ad.id) && ad.tier === 'premium'
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Add padding-top if premium ad is displayed at top */}
      {hasPremiumAd && <div style={{ height: '90px' }} />}
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary to-secondary text-white py-12 sm:py-16 md:py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
            <div 
              ref={heroTextRef}
              className="opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
                <span className="inline-block opacity-0 translate-x-[-20px] transition-all duration-700 delay-100 animate-out">Kenya's Premier</span>
                <br />
                <span className="inline-block opacity-0 translate-x-[-20px] transition-all duration-700 delay-300 animate-out text-accent"> Poultry</span>
                <span className="inline-block opacity-0 translate-x-[-20px] transition-all duration-700 delay-500 animate-out"> Marketplace</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-gray-200 opacity-0 translate-y-4 transition-all duration-700 delay-700 animate-out">
                Connect with trusted poultry farmers across Kenya. Buy quality chicks, eggs, and meat 
                directly from verified suppliers.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 opacity-0 translate-y-4 transition-all duration-700 delay-900 animate-out">
                <Link to="/products" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-black font-semibold px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg transform hover:scale-105 transition-transform">
                    Browse Products
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 inline-block group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                {!user && (
                  <Link to="/register" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto border-white text-primary hover:bg-white hover:text-black px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg transform hover:scale-105 transition-transform">
                      Become a Vendor
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            {/* Animated Image Carousel */}
            <div className="relative h-[300px] sm:h-[400px] md:h-[450px] lg:h-[500px] w-full">
              <div className="relative w-full h-full rounded-lg shadow-2xl overflow-hidden bg-gray-200">
                {heroImages.map((image, index) => (
                  <div
                    key={`hero-image-${index}-${image.url.substring(0, 20)}`}
                    className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                      index === currentHeroImageIndex
                        ? 'opacity-100 scale-100 translate-x-0 z-10'
                        : index < currentHeroImageIndex
                        ? 'opacity-0 scale-95 -translate-x-full z-0'
                        : 'opacity-0 scale-95 translate-x-full z-0'
                    }`}
                  >
                    <img 
                      key={`img-${index}-${image.url.substring(0, 20)}`}
                      src={image.url} 
                      alt={image.alt} 
                      className="w-full h-full object-cover"
                      style={{ 
                        objectFit: 'cover', 
                        objectPosition: image.objectPosition || 'center center',
                        width: '100%', 
                        height: '100%',
                        minHeight: '100%',
                        minWidth: '100%'
                      }}
                      loading="eager"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        // Fallback to a reliable poultry image if original fails
                        // Use different fallbacks based on image index to avoid all showing the same image
                        const target = e.target as HTMLImageElement;
                        const fallbackImages = [
                          "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=1200&h=800&auto=format&fit=crop&q=90", // eggs
                          "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=1200&h=800&auto=format&fit=crop&q=90", // live chicken
                          "https://images.unsplash.com/photo-1606914469633-bd39294ea743?w=1200&h=800&auto=format&fit=crop&q=90", // meat
                          "https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=1200&h=800&auto=format&fit=crop&q=90", // chicks
                          "https://images.unsplash.com/photo-1564759224907-6b3d55e4d7f9?w=1200&h=800&auto=format&fit=crop&q=90", // farm
                          "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=1200&h=800&auto=format&fit=crop&q=90" // feed
                        ];
                        const imageIndex = heroImages.findIndex(img => img.url === target.src);
                        if (imageIndex >= 0 && imageIndex < fallbackImages.length) {
                          target.src = fallbackImages[imageIndex];
                        }
                      }}
                    />
                    {/* Gradient overlay for better text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                  </div>
                ))}
                
                {/* Image indicators - Mobile responsive */}
                <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 sm:gap-2 z-20">
                  {heroImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentHeroImageIndex(index);
                        // Reset interval
                        if (heroImageIntervalRef.current) {
                          clearInterval(heroImageIntervalRef.current);
                        }
                        heroImageIntervalRef.current = setInterval(() => {
                          setCurrentHeroImageIndex((prev) => (prev + 1) % heroImages.length);
                        }, 5000);
                      }}
                      className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                        index === currentHeroImageIndex
                          ? 'w-6 sm:w-8 bg-accent'
                          : 'w-1.5 sm:w-2 bg-white/50 hover:bg-white/75'
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
                
                {/* Stats badge with animation - Mobile responsive */}
                <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-accent text-black p-2 sm:p-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform z-10 animate-pulse-slow">
                  <p className="font-bold text-sm sm:text-lg">500+ Farmers</p>
                  <p className="text-xs sm:text-sm">Trusted Network</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advertisements - Floating Overlays (Premium: top banner, Basic: bottom-right popup) */}
      {/* Show only one ad at a time with rotation */}
      {advertisements.length > 0 && advertisements
        .filter(ad => visibleAds.has(ad.id))
        .map((ad) => (
          <AdvertisementBanner
            key={ad.id}
            advertisement={ad}
            onClose={() => handleAdClose(ad.id)}
            pageLocation="homepage"
          />
        ))}

      {/* Features Section */}
      <section 
        ref={featuresRef}
        className="py-16 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out">
            <h2 className="text-3xl md:text-3xl font-bold text-primary mb-4">
              Why Choose PoultryHubKenya (KE)?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're revolutionizing Kenya's poultry industry by connecting farmers directly with customers
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="card-hover opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out transform hover:scale-105"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center transform hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-primary">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section 
        ref={categoriesRef}
        className="py-16 bg-beige"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Shop by Category
            </h2>
            <p className="text-xl text-gray-600">
              Find exactly what you need for your poultry business
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.map((category, index) => (
              <Card 
                key={index} 
                className="card-hover overflow-hidden opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out transform hover:scale-105"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <h3 className="text-2xl font-bold text-white">{category.name}</h3>
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-gray-600 mb-4">{category.description}</p>
                  <Link to="/products" className="text-primary font-semibold flex items-center hover:text-primary/80 group">
                    Shop Now
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section 
        ref={testimonialsRef}
        className="py-16 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              What Our Community Says
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of satisfied farmers and customers
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className="card-hover opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out transform hover:scale-105"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-accent fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4 italic">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-primary">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section ref={ctaRef} className="py-16 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 opacity-0 translate-y-8 transition-all duration-1000 ease-out animate-out">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 text-gray-200 max-w-2xl mx-auto opacity-0 translate-y-8 transition-all duration-1000 delay-200 ease-out animate-out">
            Join Kenya's largest poultry marketplace today and connect with trusted farmers and customers
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center opacity-0 translate-y-8 transition-all duration-1000 delay-400 ease-out animate-out">
            {!user && (
              <Link to="/register" className="inline-block">
                <Button className="bg-accent hover:bg-accent/90 text-black font-semibold px-8 py-3 text-lg transform hover:scale-105 transition-transform">
                  Start Selling
                </Button>
              </Link>
            )}
            <Link to="/products" className="inline-block">
              <Button variant="outline" className="border-white text-black hover:bg-white hover:text-primary px-8 py-3 text-lg transform hover:scale-105 transition-transform">
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;

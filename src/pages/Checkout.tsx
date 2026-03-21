import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, MapPin, Phone, CreditCard, Shield, Lock, Truck, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import OrderSuccessModal from '../components/OrderSuccessModal';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { toast } from 'sonner';
import { getApiUrl } from '../config/api';

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { cartItems, cartSummary, getLocalCart, mergeLocalCart, refreshCart } = useCart();
  
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | undefined>(undefined);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [loadingDeliveryFee, setLoadingDeliveryFee] = useState(true);
  
  // Locations states
  const [counties, setCounties] = useState<any[]>([]);
  const [pickupStations, setPickupStations] = useState<any[]>([]);
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedPickupStation, setSelectedPickupStation] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(false);
  const orderSummaryRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    shipping_address: '',
    contact_phone: user?.phone || '',
    notes: ''
  });

  // Fetch counties on mount
  useEffect(() => {
    fetch(getApiUrl('/api/location/counties'))
      .then(res => res.json())
      .then(data => {
        if (data.success) setCounties(data.data);
      })
      .catch(err => console.error('Error fetching counties:', err));
  }, []);

  // Fetch pickup stations when county changes
  useEffect(() => {
    if (selectedCounty) {
      setLoadingLocations(true);
      fetch(getApiUrl(`/api/public/pickup-locations/county/${selectedCounty}`))
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setPickupStations(data.data);
            setSelectedPickupStation(''); // Reset selection
          }
        })
        .catch(err => console.error('Error fetching pickup stations:', err))
        .finally(() => setLoadingLocations(false));
    } else {
      setPickupStations([]);
    }
  }, [selectedCounty]);

  // Get product from URL if coming from "Order Now"
  const productId = searchParams.get('product');
  const quantity = parseInt(searchParams.get('quantity') || '1');
  const [singleProduct, setSingleProduct] = useState<any>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  useEffect(() => {
    // If user just logged in, merge local cart
    if (user) {
      mergeLocalCart();
      refreshCart();
    }
  }, [user, mergeLocalCart, refreshCart]);

  // Fetch single product if productId is in URL
  useEffect(() => {
    if (productId) {
      setLoadingProduct(true);
      fetch(getApiUrl(`/api/products/${productId}`))
        .then(res => res.json())
        .then(data => {
          setSingleProduct(data);
        })
        .catch(err => {
          console.error('Error fetching product:', err);
          toast.error('Failed to load product');
        })
        .finally(() => setLoadingProduct(false));
    }
  }, [productId]);

  // Get items to display (from cart or single product)
  const getCheckoutItems = () => {
    if (productId && singleProduct) {
      // Single product order
      return [{
        product_id: singleProduct.id,
        product_name: singleProduct.name,
        price: singleProduct.price,
        quantity: quantity,
        unit: singleProduct.unit,
        image_url: Array.isArray(singleProduct.image_urls) 
          ? singleProduct.image_urls[0] 
          : (typeof singleProduct.image_urls === 'string' 
            ? JSON.parse(singleProduct.image_urls || '[]')[0] 
            : '')
      }];
    }
    
    // Use cart items if logged in, otherwise use local cart
    if (user && cartItems.length > 0) {
      return cartItems;
    }
    
    // Get from local storage if not logged in
    const localCart = getLocalCart();
    return localCart.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      price: item.price,
      quantity: item.quantity,
      unit: item.unit,
      image_url: item.image_url
    }));
  };

  const checkoutItems = getCheckoutItems();
  const subtotal = checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(5000);
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;
  const actualDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  const totalAmount = subtotal + actualDeliveryFee;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024) return;
    if (loadingProduct) return;
    if (checkoutItems.length === 0 && !productId) return;

    const scrollToSummary = () => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      orderSummaryRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    };

    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(scrollToSummary, 50);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loadingProduct, checkoutItems.length, productId]);

  // Fetch delivery fee from settings
  useEffect(() => {
    const fetchDeliverySettings = async () => {
      try {
        const [feeRes, thresholdRes] = await Promise.all([
          fetch(getApiUrl('/api/settings?key=delivery_fee')),
          fetch(getApiUrl('/api/settings?key=free_delivery_threshold'))
        ]);
        
        const feeData = await feeRes.json();
        const thresholdData = await thresholdRes.json();
        
        if (feeData.success) {
          setDeliveryFee(Number(feeData.value) || 0);
        }
        if (thresholdData.success) {
          setFreeDeliveryThreshold(Number(thresholdData.value) || 5000);
        }
      } catch (error) {
        console.error('Failed to fetch delivery settings:', error);
        setDeliveryFee(100); // Default fallback
      } finally {
        setLoadingDeliveryFee(false);
      }
    };
    fetchDeliverySettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      // Redirect to login with return URL (preserve product/quantity params if present)
      const currentParams = new URLSearchParams(searchParams);
      const redirectUrl = `/checkout${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
      navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    if (checkoutItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!selectedCounty) {
      toast.error('Please select a county');
      return;
    }

    if (!selectedPickupStation) {
      toast.error('Please select a pickup station');
      return;
    }

    const pickupStation = pickupStations.find(p => p.id.toString() === selectedPickupStation);
    const shippingAddress = pickupStation ? `Pickup at: ${pickupStation.name} - ${pickupStation.address}` : '';

    if (!formData.contact_phone.trim()) {
      toast.error('Contact phone is required');
      return;
    }

    setLoading(true);

    try {
      // Store checkout data in session storage for payment page
      sessionStorage.setItem('pendingCheckout', JSON.stringify({
        items: checkoutItems,
        shipping_address: shippingAddress,
        contact_phone: formData.contact_phone.trim(),
        notes: formData.notes.trim() || 'Order from checkout',
        subtotal: subtotal,
        delivery_fee: actualDeliveryFee,
        total_amount: totalAmount
      }));

      // Add a small intentional delay so the user sees the "Moving to Payment" state
      // This makes the transition feel smoother and more "premium"
      setTimeout(() => {
        navigate('/payment');
        setLoading(false);
      }, 1500);

    } catch (error) {
      console.error('Error saving checkout data:', error);
      toast.error('Failed to proceed to payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createOrdersAfterPayment = async (paymentReference: string) => {
    try {
      const pendingCheckout = sessionStorage.getItem('pendingCheckout');
      if (!pendingCheckout) {
        toast.error('Checkout data lost. Please try again.');
        return;
      }

      const checkoutData = JSON.parse(pendingCheckout);
      
      // Create orders now that payment is successful
      const orderPromises = checkoutData.items.map((item: any) =>
        fetch(getApiUrl('/api/orders'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            product_id: item.product_id,
            quantity: item.quantity,
            shipping_address: checkoutData.shipping_address,
            contact_phone: checkoutData.contact_phone,
            payment_method: 'paystack',
            payment_account_number: '',
            notes: checkoutData.notes,
            payment_reference: paymentReference
          })
        })
      );

      const responses = await Promise.all(orderPromises);
      const results = await Promise.all(responses.map(r => r.json()));

      // Check if all orders succeeded
      const failedOrders = results.filter(r => !r.success && r.success !== undefined);

      if (failedOrders.length > 0) {
        toast.error('Some orders failed. Please contact support.');
        return;
      }

      // Clear cart after successful order creation
      if (user) {
        await fetch(getApiUrl('/api/cart/clear'), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        refreshCart();
      } else {
        localStorage.removeItem('local_cart');
      }

      // Clear session storage
      sessionStorage.removeItem('pendingCheckout');

      // Redirect to success page
      window.location.href = `/checkout/success?reference=${paymentReference}`;

    } catch (error) {
      console.error('Error creating orders after payment:', error);
      toast.error('Order creation failed. Please contact support with your payment reference.');
    }
  };

  // If loading product, show loading state
  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // If not logged in and no items in local cart, redirect
  if (!user && checkoutItems.length === 0 && !productId) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Cart is Empty</h1>
            <p className="text-gray-600 mb-8">Add items to your cart before checkout.</p>
            <Button onClick={() => navigate('/products')}>
              Browse Products
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/products')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Shopping
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary - Priority 1 on Mobile */}
          <div ref={orderSummaryRef} className="order-1 lg:order-2 lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              <Card className="border-primary/20 shadow-md">
                <CardHeader className="bg-primary/5 pb-3">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <ShoppingCart className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {/* Order Items */}
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {checkoutItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-3 pb-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product_name}</p>
                            <p className="text-xs text-gray-500">
                              {item.quantity} x KSH {item.price.toLocaleString()}
                            </p>
                          </div>
                          <p className="font-semibold text-sm whitespace-nowrap">
                            KSH {(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="space-y-2 pt-3 border-t">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>KSH {subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Delivery Fee</span>
                        {loadingDeliveryFee ? (
                          <span className="text-gray-400">Loading...</span>
                        ) : isFreeDelivery ? (
                          <span className="text-green-600 font-bold">FREE</span>
                        ) : (
                          <span>KSH {deliveryFee.toLocaleString()}</span>
                        )}
                      </div>
                      {!isFreeDelivery && freeDeliveryThreshold > 0 && !loadingDeliveryFee && (
                        <p className="text-[10px] text-orange-600 font-medium">
                          Add KSH {(freeDeliveryThreshold - subtotal).toLocaleString()} more for free delivery
                        </p>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                        <span>Total</span>
                        <span className="text-primary">KSH {totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Secure Payment Badges - Immediate Trust on Mobile */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-[10px] font-bold text-green-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span>Secure</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>Encrypted</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>Verified</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Delivery Information - Priority 2 on Mobile */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Delivery & Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Select County <span className="text-red-500">*</span>
                      </label>
                      <Select 
                        value={selectedCounty} 
                        onValueChange={setSelectedCounty}
                        disabled={loading}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select County" />
                        </SelectTrigger>
                        <SelectContent>
                          {counties.map(c => (
                            <SelectItem key={c.county_id} value={c.county_id.toString()}>
                              {c.county_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Select Pickup Station <span className="text-red-500">*</span>
                      </label>
                      <Select 
                        value={selectedPickupStation} 
                        onValueChange={setSelectedPickupStation}
                        disabled={loading || !selectedCounty || loadingLocations}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={
                            loadingLocations 
                              ? "Loading stations..." 
                              : (selectedCounty ? "Select Station" : "Select County first")
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {pickupStations.length > 0 ? (
                            pickupStations.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name} - {p.address || 'N/A'}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">
                              {selectedCounty ? "No pickup stations available" : "Please select a county first"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      className="h-11"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="07XX XXX XXX"
                      required
                      disabled={loading}
                    />
                    <p className="text-[10px] text-gray-500">We'll use this number for delivery notifications.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Order Notes (Optional)
                    </label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Special instructions for delivery..."
                      rows={2}
                      disabled={loading}
                    />
                  </div>

                  {!user && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 mb-3">
                        Please login to complete your order. Your items will be saved.
                      </p>
                      <Button
                        type="button"
                        onClick={() => {
                          const currentParams = new URLSearchParams(searchParams);
                          const redirectUrl = `/checkout${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
                          navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
                        }}
                        className="w-full h-11"
                      >
                        Login to Continue
                      </Button>
                    </div>
                  )}

                  {user && (
                    <div className="space-y-4 pt-2">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3">
                        <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 leading-tight">
                          Review your order summary and delivery details on the next page before completing your secure payment.
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 text-white h-14 text-xl font-bold shadow-lg shadow-primary/20"
                        disabled={loading || checkoutItems.length === 0}
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Moving to Payment...</span>
                          </div>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <span>Continue to Payment</span>
                            <ArrowRight className="w-6 h-6" />
                          </span>
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Additional Payment Info */}
            <Card className="bg-white border shadow-sm">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Secure Payment Methods Powered by Paystack</p>
                  <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
                    {/* VISA */}
                    <div className="font-bold text-[#1A1F71] text-2xl italic tracking-tighter">VISA</div>
                    
                    {/* Mastercard */}
                    <div className="flex gap-1 items-center">
                      <div className="w-5 h-5 bg-[#EB001B] rounded-full"></div>
                      <div className="w-5 h-5 bg-[#FF5F00] rounded-full -ml-3 opacity-90"></div>
                      <span className="ml-1 text-xs font-bold text-gray-800 tracking-tight">mastercard</span>
                    </div>

                    {/* M-PESA */}
                    <div className="flex items-center">
                      <span className="font-black text-[#1eb32a] text-lg">M-PESA</span>
                    </div>

                    {/* Airtel Money */}
                    <div className="flex items-center">
                      <div className="bg-[#E11900] text-white px-2 py-0.5 rounded font-bold text-sm tracking-tight">airtel</div>
                      <span className="ml-1 font-bold text-[#E11900] text-sm">money</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />

      {/* Order Success Modal */}
      <OrderSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          navigate('/dashboard');
        }}
        orderNumber={orderNumber}
      />
    </div>
  );
};

export default Checkout;

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, MapPin, Phone, CreditCard, Shield, Lock, Truck } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import OrderSuccessModal from '../components/OrderSuccessModal';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
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
  const [formData, setFormData] = useState({
    shipping_address: '',
    contact_phone: user?.phone || '',
    notes: ''
  });

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
  const totalAmount = checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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

    // Validate form
    if (!formData.shipping_address.trim()) {
      toast.error('Shipping address is required');
      return;
    }

    if (!formData.contact_phone.trim()) {
      toast.error('Contact phone is required');
      return;
    }

    setLoading(true);

    try {
      console.log('Initializing payment with data:', {
        order_id: 0,
        amount: totalAmount,
        email: user?.email || 'customer@poultryhubkenya.com',
        callback_url: `${window.location.origin}/checkout/success`
      });

      // Check if token exists and is valid
      const token = localStorage.getItem('token');
      console.log('JWT Token:', token ? 'exists' : 'missing');
      
      if (!token) {
        console.error('No JWT token found');
        toast.error('Please login to continue');
        setLoading(false);
        navigate('/login');
        return;
      }

      // Test token validity first
      try {
        const tokenTestResponse = await fetch(getApiUrl('/api/users/me'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (tokenTestResponse.status === 401) {
          console.error('JWT token expired or invalid');
          toast.error('Your session has expired. Please login again.');
          localStorage.removeItem('token');
          setLoading(false);
          navigate('/login');
          return;
        }
        
        console.log('Token is valid');
      } catch (tokenError) {
        console.error('Token validation failed:', tokenError);
        toast.error('Authentication error. Please login again.');
        localStorage.removeItem('token');
        setLoading(false);
        navigate('/login');
        return;
      }

      // Test API connectivity first
      try {
        const testResponse = await fetch(getApiUrl('/test_api.php'));
        console.log('Test API response:', testResponse.status);
        const testData = await testResponse.json();
        console.log('Test API data:', testData);
      } catch (testError) {
        console.error('Test API failed:', testError);
        toast.error('API connectivity test failed. Check if backend is running.');
        setLoading(false);
        return;
      }

      // Initialize Paystack payment first (no order created yet)
      const apiUrl = getApiUrl('/test_payment_init.php'); // Test endpoint first
      console.log('API URL:', apiUrl);

      const paymentResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: 0, // Temporary ID for payment initialization
          amount: totalAmount,
          email: user?.email || 'customer@poultryhubkenya.com',
          callback_url: `${window.location.origin}/checkout/success`
        })
      });

      console.log('Payment response status:', paymentResponse.status);
      console.log('Payment response headers:', Object.fromEntries(paymentResponse.headers.entries()));

      // Get response text first to see if it's valid JSON
      const responseText = await paymentResponse.text();
      console.log('Raw response text:', responseText);

      let paymentData;
      try {
        paymentData = JSON.parse(responseText);
        console.log('Parsed payment data:', paymentData);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response was:', responseText);
        toast.error('Invalid response from server. Please try again.');
        setLoading(false);
        return;
      }

      if (!paymentData.success) {
        console.error('Payment initialization failed:', paymentData);
        toast.error(paymentData.error || 'Failed to initialize payment. Please try again.');
        setLoading(false);
        return;
      }

      // Store checkout data in session storage for payment page
      sessionStorage.setItem('pendingCheckout', JSON.stringify({
        items: checkoutItems,
        shipping_address: formData.shipping_address.trim(),
        contact_phone: formData.contact_phone.trim(),
        notes: formData.notes.trim() || 'Order from checkout',
        payment_reference: paymentData.reference
      }));

      // Navigate to payment page instead of opening popup
      navigate('/payment');
      setLoading(false);

    } catch (error) {
      console.error('Error initializing payment:', error);
      toast.error('Failed to initialize payment. Please try again.');
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
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Order Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shipping Address <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={formData.shipping_address}
                      onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                      placeholder="Enter your complete delivery address"
                      required
                      rows={3}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 ml-1">(For delivery updates)</span>
                    </label>
                    <Input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="07XX XXX XXX"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Notes (Optional)
                    </label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any special instructions for delivery"
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
                        className="w-full"
                      >
                        Login to Continue
                      </Button>
                    </div>
                  )}

                  {user && (
                    <>
                      {/* Payment Notice */}
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 text-orange-600 flex-shrink-0">
                            <svg fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="text-sm text-orange-700">
                            <span className="font-medium">Clicking "Proceed to Payment" will open Paystack's secure popup</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-lg font-semibold"
                        disabled={loading || checkoutItems.length === 0}
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <span>Initializing Payment</span>
                            <span className="animate-dots">
                              <span>.</span>
                              <span>.</span>
                              <span>.</span>
                            </span>
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            <span>Proceed to Payment</span>
                          </span>
                        )}
                      </Button>
                    </>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Trust Signals */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-center space-x-8 text-sm text-blue-700">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <span>Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    <span>Fast Delivery</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    <span>SSL Encrypted</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Order Items */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {checkoutItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-3 pb-3 border-b">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-gray-600">
                              {item.quantity} x KSH {item.price.toLocaleString()}
                            </p>
                          </div>
                          <p className="font-semibold">
                            KSH {(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="space-y-2 pt-4 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span>KSH {totalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Delivery</span>
                        <span className="text-green-600">FREE</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total</span>
                        <span className="text-primary">KSH {totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card className="bg-gray-50">
                <CardContent className="p-4">
                  <div className="text-center space-y-2">
                    <p className="text-xs text-gray-600 font-medium">We Accept</p>
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-8 h-5 bg-gray-800 rounded flex items-center justify-center text-white text-xs font-bold">VISA</div>
                      <div className="w-8 h-5 bg-red-600 rounded flex items-center justify-center text-white text-xs font-bold">MC</div>
                      <div className="w-8 h-5 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">MPESA</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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


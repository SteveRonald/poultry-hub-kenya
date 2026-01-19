import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Shield, Lock, Truck, Clock, CheckCircle, AlertCircle, ShoppingCart } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { cartItems, cartSummary, getLocalCart } = useCart();
  
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');

  useEffect(() => {
    // Get payment data from session storage
    const pendingCheckout = sessionStorage.getItem('pendingCheckout');
    if (!pendingCheckout) {
      navigate('/checkout');
      return;
    }

    try {
      const data = JSON.parse(pendingCheckout);
      setPaymentData(data);
      
      // Initialize payment when component mounts
      initializePayment(data);
    } catch (error) {
      console.error('Error parsing payment data:', error);
      navigate('/checkout');
    }
  }, [navigate]);

  const initializePayment = async (checkoutData: any) => {
    setLoading(true);
    setPaymentStatus('processing');
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Initialize Paystack payment first (no order created yet)
      const apiUrl = getApiUrl('/api/payments/paystack/initialize');
      console.log('API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: 0,
          amount: checkoutData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
          email: user?.email || 'customer@poultryhubkenya.com',
          callback_url: `${window.location.origin}/api/payments/paystack/webhook` // Use proper webhook URL
        })
      });

      // Get response as text first to debug
      const responseText = await response.text();
      console.log('Raw payment response:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response was:', responseText);
        throw new Error('Server returned invalid response. Please check backend logs.');
      }
      
      if (result.success) {
        // Create payment popup with checkout data
        createPaymentPopup(result, checkoutData);
      } else {
        throw new Error(result.error || 'Payment initialization failed');
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      setError(error.message || 'Failed to initialize payment');
      setPaymentStatus('failed');
      toast.error(error.message || 'Payment initialization failed');
    } finally {
      setLoading(false);
    }
  };

  const createPaymentPopup = (paymentResult: any, checkoutData: any) => {
    // Remove any existing Paystack popups
    const existingScript = document.querySelector('script[src*="paystack"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // Get selected payment method from checkout data or default to card
    const selectedPaymentMethod = checkoutData?.payment_method || 'card';
    console.log('Selected payment method:', selectedPaymentMethod);
    
    // Calculate amount from passed data
    const totalAmount = checkoutData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      const handler = (window as any).PaystackPop.setup({
        key: paymentResult.public_key,
        email: user?.email || 'customer@poultryhubkenya.com',
        amount: totalAmount * 100, // Convert to kobo/cents
        ref: paymentResult.reference,
        currency: 'KES', // Specify Kenyan Shillings
        callback: function(response: any) {
          console.log('Payment successful - Full response:', response);
          console.log('Payment channel:', response.channel);
          console.log('Payment transaction:', response.transaction);
          console.log('Payment customer:', response.customer);
          console.log('All response keys:', Object.keys(response));
          
          // Store payment details from Paystack response
          const paymentDetails = {
            reference: response.reference,
            transaction: response.transaction, // Payment method details
            channel: response.channel || selectedPaymentMethod, // Use selected method as primary
            selected_method: selectedPaymentMethod, // Store user's selection from checkout
            customer: response.customer,
            paid_at: new Date().toISOString()
          };
          
          console.log('Stored payment details:', paymentDetails);
          
          // Store payment details in session for verification
          sessionStorage.setItem('payment_details', JSON.stringify(paymentDetails));
          
          // Manually verify payment since webhook doesn't work on localhost
          verifyPaymentManually(response.reference);
        },
        onClose: function() {
          console.log('Payment popup closed');
          toast.info('Payment window was closed. You can try again.');
          setPaymentStatus('pending');
          setLoading(false);
        }
      });
      
      handler.openIframe();
    };
    
    script.onerror = () => {
      console.error('Failed to load Paystack script');
      toast.error('Failed to load payment gateway. Please try again.');
      setPaymentStatus('failed');
      setLoading(false);
    };
    
    document.body.appendChild(script);
  };

  const verifyPaymentManually = async (reference: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Get checkout data from session storage
      const pendingCheckout = sessionStorage.getItem('pendingCheckout');
      const checkoutData = pendingCheckout ? JSON.parse(pendingCheckout) : null;
      
      // Get payment details from Paystack
      const paymentDetails = sessionStorage.getItem('payment_details');
      const paymentData = paymentDetails ? JSON.parse(paymentDetails) : null;

      console.log('=== MANUAL VERIFICATION STARTING ===');
      console.log('Reference:', reference);
      console.log('Token exists:', !!token);
      console.log('Checkout data:', checkoutData);
      console.log('Payment details:', paymentData);

      const response = await fetch(getApiUrl('/api/payments/manual/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reference: reference,
          checkout_data: checkoutData,
          payment_details: paymentData // Pass payment details from Paystack
        })
      });

      console.log('Manual verification response status:', response.status);
      const result = await response.json();
      console.log('Manual verification result:', result);
      
      if (result.success) {
        console.log('=== PAYMENT VERIFICATION SUCCESS ===');
        console.log('Setting payment_success in sessionStorage...');
        
        const successData = {
          reference: reference,
          message: `Payment completed and ${result.order_count} order(s) created successfully`,
          order_ids: result.order_ids
        };
        
        sessionStorage.setItem('payment_success', JSON.stringify(successData));
        console.log('payment_success set to:', successData);
        
        toast.success(`Payment verified! ${result.order_count} order(s) created.`);
        
        // Clear payment details from session
        sessionStorage.removeItem('payment_details');
        
        // Clear cart after successful payment
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('cart');
          // Also clear any cart-related session data
          sessionStorage.removeItem('cart_items');
          sessionStorage.removeItem('cart_summary');
          console.log('Cart and session cleared after successful payment');
        }
        
        // Clear pending checkout
        sessionStorage.removeItem('pendingCheckout');
        
        console.log('=== NAVIGATING TO SUCCESS PAGE ===');
        console.log('=== NAVIGATING TO SUCCESS PAGE ===');
        console.log('Navigation URL:', `/checkout/success?reference=${reference}`);
        navigate(`/checkout/success?reference=${reference}`);
      } else {
        console.log('=== PAYMENT VERIFICATION FAILED ===');
        throw new Error(result.error || 'Payment verification failed');
      }
    } catch (error: any) {
      console.error('=== MANUAL VERIFICATION ERROR ===', error);
      toast.error(error.message || 'Payment verification failed');
      setPaymentStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = () => {
    if (paymentData) {
      initializePayment(paymentData);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('pendingCheckout');
    navigate('/checkout');
  };

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Payment...</h2>
            <p className="text-gray-600">Please wait while we prepare your payment.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const totalAmount = paymentData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Checkout
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
            <p className="text-gray-600">Complete your order securely with Paystack</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paymentData.items.map((item: any, index: number) => (
                    <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        {item.image_url ? (
                          <img
                            src={getImageUrl(item.image_url.replace(/\\/g, '/'))}
                            alt={item.product_name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="text-gray-400 text-xs">No Image</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{item.product_name}</h4>
                        <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                        <p className="text-sm font-medium text-primary">
                          KSH {item.price.toLocaleString()} each
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          KSH {(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>KSH {totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Delivery</span>
                      <span className="text-green-600">FREE</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-lg font-bold text-gray-900">Total Amount:</span>
                      <span className="text-2xl font-bold text-primary">
                        KSH {totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Information */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Truck className="h-5 w-5 mr-2" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Shipping Address</p>
                    <p className="text-gray-600">{paymentData.shipping_address}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Contact Phone</p>
                    <p className="text-gray-600">{paymentData.contact_phone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Contact Email</p>
                    <p className="text-gray-600">{user?.email || 'customer@poultryhubkenya.com'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentStatus === 'processing' && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Initializing Payment...</h3>
                    <p className="text-gray-600">Please wait while we connect to Paystack</p>
                  </div>
                )}

                {paymentStatus === 'failed' && (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Failed</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <div className="space-x-3">
                      <Button onClick={handleRetryPayment} className="btn-primary">
                        Retry Payment
                      </Button>
                      <Button variant="outline" onClick={handleCancel}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {paymentStatus === 'pending' && (
                  <div className="space-y-6">
                    {/* Security Badges */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-xs font-medium text-green-800">Secure Payment</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <Lock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-xs font-medium text-blue-800">SSL Encrypted</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <CheckCircle className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                        <p className="text-xs font-medium text-purple-800">Paystack Protected</p>
                      </div>
                    </div>

                    {/* Payment Methods */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Accepted Payment Methods</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 border rounded-lg text-center">
                          <CreditCard className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                          <p className="text-sm font-medium">Card Payment</p>
                        </div>
                        <div className="p-3 border rounded-lg text-center">
                          <div className="h-6 w-6 mx-auto mb-2 text-green-600 font-bold text-sm">M-PESA</div>
                          <p className="text-sm font-medium">Mobile Money</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <Button 
                        onClick={() => initializePayment(paymentData)}
                        className="w-full btn-primary"
                        disabled={loading}
                      >
                        {loading ? (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <CreditCard className="h-4 w-4 mr-2" />
                            Proceed to Payment - KSH {totalAmount.toLocaleString()}
                          </span>
                        )}
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={handleCancel}
                        className="w-full"
                        disabled={loading}
                      >
                        Cancel Payment
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trust Indicators */}
            <Card className="mt-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>24/7 Support</span>
                  </div>
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    <span>100% Secure</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span>Instant Confirmation</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PaymentPage;

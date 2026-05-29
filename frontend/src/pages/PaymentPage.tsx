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
  const { cartItems, cartSummary, getLocalCart, clearCart } = useCart();
  
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'initializing' | 'verifying' | 'success' | 'failed'>('pending');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(5000);

  // Fetch delivery settings
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
      }
    };
    
    fetchDeliverySettings();
  }, []);

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
      // No longer auto-initializing payment here
    } catch (error) {
      console.error('Error parsing payment data:', error);
      navigate('/checkout');
    }
  }, [navigate]);

  const initializePayment = async (checkoutData: any) => {
    setLoading(true);
    setPaymentStatus('initializing');
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Initialize Paystack payment first (no order created yet)
      const apiUrl = getApiUrl('/api/payments/paystack/initialize');
      console.log('API URL:', apiUrl);

      // Use total_amount from checkout (includes delivery fee) or calculate from items
      const subtotal = checkoutData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const paymentAmount = checkoutData.total_amount || subtotal;
      
      console.log('Initializing payment with amount:', paymentAmount, '(subtotal:', subtotal, ', delivery:', checkoutData.delivery_fee || 0, ')');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: 0,
          amount: paymentAmount, // Total amount including delivery fee
          subtotal: subtotal,
          delivery_fee: checkoutData.delivery_fee || 0,
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
    
    // Calculate amount from passed data - use total_amount if available (includes delivery fee)
    const subtotal = checkoutData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const totalAmount = checkoutData.total_amount || subtotal;
    
    console.log('Payment amount calculation:', { subtotal, totalAmount, checkoutDeliveryFee: checkoutData.delivery_fee });
    
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      const handler = (window as any).PaystackPop.setup({
        key: paymentResult.public_key,
        email: user?.email || 'customer@poultryhubkenya.com',
        amount: totalAmount * 100, // Convert to kobo/cents - includes delivery fee
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
            amount: totalAmount, // Include the total amount with delivery fee
            subtotal: subtotal,
            delivery_fee: checkoutData.delivery_fee || 0,
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
          toast.warning('Payment was cancelled or the window was closed. Your order has not been completed.');
          
          // Log the cancellation
          fetch(getApiUrl('/api/system/log'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'payment_window_closed',
              details: { 
                reference: paymentResult.reference,
                reason: 'user_closed_or_cancelled'
              }
            })
          }).catch(() => {});

          setPaymentStatus('pending');
          setLoading(false);
        }
      });
      
      // Log that the popup is being opened
      fetch(getApiUrl('/api/system/log'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payment_window_opened',
          details: { reference: paymentResult.reference }
        })
      }).catch(() => {});

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
      // Set status to verifying
      setPaymentStatus('verifying');
      
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
      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Server returned an empty response during verification. Please try again.');
      }
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse verification JSON:', parseError);
        console.error('Verification response was:', responseText);
        throw new Error('Server returned invalid verification data. Please try again.');
      }
      console.log('Manual verification result:', result);
      
      if (response.ok && result.success) {
        console.log('=== PAYMENT VERIFICATION SUCCESS ===');
        console.log('Setting payment_success in sessionStorage...');
        
        const successData = {
          reference: reference,
          message: `Payment completed and ${result.order_count} order(s) created successfully`,
          order_ids: result.order_ids,
          amount: result.amount,
          payment_method: result.payment_method,
          channel: result.channel,
          selected_method: result.selected_method
        };
        
        console.log('=== STORING SUCCESS DATA ===');
        console.log('Success data to store:', successData);
        console.log('Amount:', successData.amount);
        console.log('Payment method:', successData.payment_method);
        console.log('Selected method:', successData.selected_method);
        
        sessionStorage.setItem('payment_success', JSON.stringify(successData));
        
        // Verify it was stored correctly
        const storedData = sessionStorage.getItem('payment_success');
        console.log('Verification - Stored data:', storedData);
        
        toast.success(`Payment verified! ${result.order_count} order(s) created.`);
        
        // Clear payment details from session
        sessionStorage.removeItem('payment_details');
        sessionStorage.removeItem('pendingCheckout');
        
        // Clear cart using cart context (this will clear both backend and frontend)
        console.log('=== CLEARING CART AFTER SUCCESSFUL PAYMENT ===');
        await clearCart(true); // Silent clear (no toast)
        
        // Also clear local storage cart items
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('cart');
          localStorage.removeItem('cart_items');
          localStorage.removeItem('cart_summary');
          localStorage.removeItem('local_cart');
          sessionStorage.removeItem('cart_items');
          sessionStorage.removeItem('cart_summary');
          console.log('=== CART CLEARED SUCCESSFULLY ===');
        }
        
        console.log('=== NAVIGATING TO SUCCESS PAGE ===');
        console.log('Navigation URL:', `/checkout/success?reference=${reference}`);
        navigate(`/checkout/success?reference=${reference}`);
      } else {
        console.log('=== PAYMENT VERIFICATION FAILED ===');
        throw new Error(result.error || `Payment verification failed (HTTP ${response.status})`);
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
    if (!paymentData) return;

    const paymentDetailsRaw = sessionStorage.getItem('payment_details');
    if (paymentDetailsRaw) {
      try {
        const paymentDetails = JSON.parse(paymentDetailsRaw);
        if (paymentDetails?.reference) {
          verifyPaymentManually(paymentDetails.reference);
          return;
        }
      } catch (error) {
        console.error('Failed to parse payment_details for retry:', error);
      }
    }

    initializePayment(paymentData);
  };

  const handleCancel = () => {
    sessionStorage.removeItem('pendingCheckout');
    navigate('/checkout');
  };

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-8 animate-pulse">
            <div className="relative inline-block">
              <div className="h-24 w-24 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <Lock className="h-10 w-10 text-primary/40" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">Preparing Secure Payment</h2>
              <p className="text-gray-500 max-w-xs mx-auto">
                Please wait while we set up your secure checkout session...
              </p>
            </div>

            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-2/3 rounded-full" />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                <span>Encryption</span>
                <span>Security Check</span>
                <span>Gateway</span>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const canRetryVerification = (() => {
    try {
      const paymentDetailsRaw = sessionStorage.getItem('payment_details');
      if (!paymentDetailsRaw) return false;
      const paymentDetails = JSON.parse(paymentDetailsRaw);
      return !!paymentDetails?.reference;
    } catch {
      return false;
    }
  })();

  // Use delivery fee from checkout data if available, otherwise calculate
  const subtotal = paymentData.subtotal || paymentData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const checkoutDeliveryFee = paymentData.delivery_fee;
  const isFreeDelivery = checkoutDeliveryFee !== undefined ? checkoutDeliveryFee === 0 : subtotal >= freeDeliveryThreshold;
  const actualDeliveryFee = checkoutDeliveryFee !== undefined ? checkoutDeliveryFee : (isFreeDelivery ? 0 : deliveryFee);
  const totalAmount = paymentData.total_amount || (subtotal + actualDeliveryFee);

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Payment Section - Priority 1 on Mobile */}
          <div className="order-1 lg:order-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentStatus === 'initializing' && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Initializing Payment...</h3>
                    <p className="text-gray-600">Please wait while we connect to Paystack</p>
                  </div>
                )}

                {paymentStatus === 'verifying' && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Verifying Payment...</h3>
                    <p className="text-gray-600">Please wait while we confirm your payment with Paystack</p>
                  </div>
                )}

                {paymentStatus === 'failed' && (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Failed</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button onClick={handleRetryPayment} className="btn-primary">
                        {canRetryVerification ? 'Retry Verification' : 'Retry Payment'}
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
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                      <div className="p-2 sm:p-3 bg-green-50 rounded-lg">
                        <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-1 sm:mb-2" />
                        <p className="text-[10px] sm:text-xs font-medium text-green-800">Secure</p>
                      </div>
                      <div className="p-2 sm:p-3 bg-blue-50 rounded-lg">
                        <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-1 sm:mb-2" />
                        <p className="text-[10px] sm:text-xs font-medium text-blue-800">Encrypted</p>
                      </div>
                      <div className="p-2 sm:p-3 bg-purple-50 rounded-lg">
                        <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto mb-1 sm:mb-2" />
                        <p className="text-[10px] sm:text-xs font-medium text-purple-800">Protected</p>
                      </div>
                    </div>

                    {/* Payment Methods */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Accepted Methods</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-2 border rounded-lg text-center flex flex-col items-center justify-center bg-white shadow-sm">
                          <div className="font-bold text-[#1A1F71] text-xs italic italic mb-1">VISA</div>
                          <div className="flex gap-0.5 items-center mb-1">
                            <div className="w-2.5 h-2.5 bg-[#EB001B] rounded-full"></div>
                            <div className="w-2.5 h-2.5 bg-[#FF5F00] rounded-full -ml-1.5"></div>
                          </div>
                          <p className="text-[10px] font-medium text-gray-600">Card</p>
                        </div>
                        <div className="p-2 border rounded-lg text-center flex flex-col items-center justify-center bg-white shadow-sm">
                          <div className="text-[#1eb32a] font-black text-xs mb-1">M-PESA</div>
                          <p className="text-[10px] font-medium text-gray-600">Safaricom</p>
                        </div>
                        <div className="p-2 border rounded-lg text-center flex flex-col items-center justify-center bg-white shadow-sm">
                          <div className="flex items-center mb-1">
                            <div className="bg-[#E11900] text-white px-1 py-0.5 rounded font-bold text-[8px] tracking-tighter">airtel</div>
                          </div>
                          <p className="text-[10px] font-medium text-gray-600">Airtel</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 shadow-sm">
                        <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-800 leading-snug">
                          Clicking <span className="font-bold">"Pay KSH {totalAmount.toLocaleString()}"</span> will open a secure Paystack window to complete your <span className="font-bold text-primary">KSH {totalAmount.toLocaleString()}</span> payment.
                        </p>
                      </div>

                      <Button 
                        onClick={() => initializePayment(paymentData)}
                        className="w-full btn-primary h-14 text-xl font-bold shadow-lg shadow-primary/20"
                        disabled={loading}
                      >
                        {loading ? (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Connecting to Secure Gateway...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <Lock className="h-5 w-5 mr-2" />
                            Pay KSH {totalAmount.toLocaleString()}
                          </span>
                        )}
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        onClick={handleCancel}
                        className="w-full h-10 text-gray-500 hover:text-red-600"
                        disabled={loading}
                      >
                        Cancel and return to checkout
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mobile Trust Indicators */}
            <Card className="lg:hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-primary" />
                    <span>24/7 Support</span>
                  </div>
                  <div className="flex items-center">
                    <Shield className="h-3 w-3 mr-1 text-primary" />
                    <span>100% Secure</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1 text-primary" />
                    <span>Verified</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary & Delivery - Priority 2 on Mobile */}
          <div className="order-2 lg:order-1 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <ShoppingCart className="h-5 w-5 mr-2 text-primary" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentData.items.map((item: any, index: number) => (
                    <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={getImageUrl(item.image_url.replace(/\\/g, '/'))}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-400 text-[10px]">No Image</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm truncate">{item.product_name}</h4>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} × KSH {item.price.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm">
                          KSH {(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-dashed pt-3 space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span className="font-medium">KSH {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Delivery</span>
                      {isFreeDelivery ? (
                        <span className="text-green-600 font-bold">FREE</span>
                      ) : (
                        <span className="font-medium">KSH {deliveryFee.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                      <span className="text-base font-bold text-gray-900">Total:</span>
                      <span className="text-xl font-bold text-primary">
                        KSH {totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Truck className="h-5 w-5 mr-2 text-primary" />
                  Delivery Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-primary/5 p-3 rounded-md border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Pickup Location</p>
                    <p className="text-sm text-gray-700 font-medium leading-snug">{paymentData.shipping_address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Contact Phone</p>
                      <p className="text-sm text-gray-700">{paymentData.contact_phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Email</p>
                      <p className="text-sm text-gray-700 truncate">{user?.email || 'N/A'}</p>
                    </div>
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

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Sparkles, Receipt, Mail, ArrowRight, Truck, Clock, ShoppingCart } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { getApiUrl } from '../config/api';

const PaystackSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [showAnimation, setShowAnimation] = useState(false);

  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');

  useEffect(() => {
    console.log('=== SUCCESS PAGE LOADING ===');
    console.log('Reference from URL:', reference);
    
    // Clear cart when success page loads (in case it wasn't cleared earlier)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('cart');
      localStorage.removeItem('cart_items');
      localStorage.removeItem('cart_summary');
      sessionStorage.removeItem('cart_items');
      sessionStorage.removeItem('cart_summary');
      sessionStorage.removeItem('pendingCheckout');
      console.log('=== CART CLEARED ON SUCCESS PAGE LOAD ===');
    }
    
    if (reference) {
      // Add delay to ensure session data is available
      const checkSessionData = () => {
        // Check if payment was already verified
        const paymentSuccess = sessionStorage.getItem('payment_success');
        const paymentDetails = sessionStorage.getItem('payment_details');
        
        console.log('=== SUCCESS PAGE SESSION CHECK ===');
        console.log('paymentSuccess:', paymentSuccess);
        console.log('paymentDetails:', paymentDetails);
        console.log('reference:', reference);
        
        if (paymentSuccess) {
          // Payment was already verified, show success directly
          try {
            const successData = JSON.parse(paymentSuccess);
            console.log('=== USING CACHED SUCCESS DATA ===');
            console.log('Success data:', successData);
            console.log('Amount:', successData.amount);
            console.log('Payment method:', successData.payment_method);
            console.log('Selected method:', successData.selected_method);
            console.log('Channel:', successData.channel);
            setPaymentStatus('success');
            setOrderDetails(successData);
            setLoading(false);
            // Clear success data
            sessionStorage.removeItem('payment_success');
            // Trigger animation
            setTimeout(() => setShowAnimation(true), 100);
          } catch (error) {
            console.error('=== ERROR PARSING SUCCESS DATA ===', error);
            // Fall back to verification
            verifyPayment(reference);
          }
        } else {
          // Need to verify payment
          console.log('=== NO CACHED SUCCESS DATA - VERIFYING PAYMENT ===');
          setTimeout(() => setShowAnimation(true), 100);
          verifyPayment(reference);
        }
      };
      
      // Try multiple times to get session data
      setTimeout(checkSessionData, 100);
      setTimeout(checkSessionData, 500);
      setTimeout(checkSessionData, 1000);
      
    } else {
      console.log('=== NO REFERENCE FOUND ===');
      setPaymentStatus('failed');
      setError('Payment reference not found');
      setLoading(false);
    }
  }, [reference]);

  const verifyPayment = async (reference: string) => {
    try {
      // Get checkout data from session storage
      const pendingCheckout = sessionStorage.getItem('pendingCheckout');
      const checkoutData = pendingCheckout ? JSON.parse(pendingCheckout) : null;

      // Get payment details from Paystack
      const paymentDetails = sessionStorage.getItem('payment_details');
      const paymentData = paymentDetails ? JSON.parse(paymentDetails) : null;

      console.log('Success page - Payment details:', paymentData);
      console.log('Success page - Checkout data:', checkoutData);

      // If no checkout data, don't try to verify again - just show success
      if (!checkoutData) {
        console.log('=== NO CHECKOUT DATA - SHOWING SUCCESS WITHOUT VERIFICATION ===');
        setPaymentStatus('success');
        setOrderDetails({
          reference: reference,
          message: 'Payment completed successfully',
          order_id: 'N/A'
        });
        setLoading(false);
        setTimeout(() => setShowAnimation(true), 100);
        return;
      }

      const response = await fetch(getApiUrl(`/api/payments/manual/verify`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reference: reference,
          checkout_data: checkoutData,
          payment_details: paymentData // Pass payment details from Paystack
        })
      });
      const data = await response.json();

      if (data.success) {
        setPaymentStatus('success');
        // Store the complete data including amount and payment method
        const completeOrderDetails = {
          ...data,
          amount: data.amount || 0,
          payment_method: data.payment_method || data.selected_method || data.channel || 'Paystack',
          selected_method: data.selected_method || data.payment_method || data.channel || 'Paystack',
          channel: data.channel || 'card'
        };
        console.log('=== COMPLETE ORDER DETAILS ===', completeOrderDetails);
        setOrderDetails(completeOrderDetails);
        // Clear payment details from session
        sessionStorage.removeItem('payment_details');
      } else {
        setPaymentStatus('failed');
        setError(data.error || 'Payment verification failed');
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      setPaymentStatus('failed');
      setError('Failed to verify payment. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/dashboard');
  };

  const handleRetry = () => {
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="relative overflow-hidden">
          <CardHeader className="text-center relative z-10">
            {loading ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                </div>
                <CardTitle className="text-xl">Verifying Payment...</CardTitle>
                <div className="w-64 space-y-2">
                  <Progress value={75} className="h-2" />
                  <p className="text-sm text-gray-600">Please wait while we confirm your payment</p>
                </div>
              </div>
            ) : paymentStatus === 'success' ? (
              <div className="text-center py-12 px-4">
                {/* Beautifully Animated Checkmark */}
                <div className="flex justify-center mb-8">
                  <div className="relative w-24 h-24">
                    <div className={`absolute inset-0 bg-emerald-100 rounded-full transition-transform duration-1000 ${showAnimation ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
                    <svg 
                      className="absolute inset-0 w-24 h-24 text-emerald-600" 
                      viewBox="0 0 52 52"
                    >
                      <circle 
                        className={`transition-all duration-700 ease-in-out fill-none stroke-current stroke-[2] ${showAnimation ? 'opacity-100' : 'opacity-0'}`}
                        cx="26" cy="26" r="25" 
                        style={{ strokeDasharray: 166, strokeDashoffset: showAnimation ? 0 : 166 }}
                      />
                      <path 
                        className={`transition-all duration-700 delay-500 ease-in-out fill-none stroke-current stroke-[3] rounded-sm ${showAnimation ? 'opacity-100' : 'opacity-0'}`}
                        d="M14.1 27.2l7.1 7.2 16.7-16.8" 
                        style={{ strokeDasharray: 48, strokeDashoffset: showAnimation ? 0 : 48 }}
                      />
                    </svg>
                  </div>
                </div>
                
                <div className="space-y-2 mb-10">
                  <h1 className="text-3xl font-bold text-gray-900">Thank you for your order!</h1>
                  <p className="text-gray-500">Your payment has been received and your order is being processed.</p>
                </div>

                {/* Key Order Info - Clean & Professional */}
                <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-8 mb-10 space-y-6 border border-gray-100">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Order Reference</span>
                    <span className="font-mono font-bold text-gray-900">#{orderDetails.reference || orderDetails.payment_reference}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Payment Status</span>
                    <span className="flex items-center gap-2 text-emerald-600 font-black bg-emerald-50 px-4 py-1 rounded-full border border-emerald-100 text-sm uppercase tracking-wider">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      {orderDetails && orderDetails.payment_status === 'paid' ? 'Paid' : 'Confirmed'}
                    </span>
                  </div>
                </div>

                {/* Simplified Next Steps */}
                <div className="max-w-md mx-auto mb-12">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">What Happens Next</h3>
                  <div className="grid grid-cols-1 gap-6 text-left">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Email Confirmation</p>
                        <p className="text-sm text-gray-500">A receipt has been sent to your registered email address.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Fast Delivery</p>
                        <p className="text-sm text-gray-500">Vendors are preparing your poultry products for immediate dispatch.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <Button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 bg-primary text-white h-14 text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all rounded-xl"
                  >
                    View Order Status
                  </Button>
                  <Button
                    onClick={() => navigate('/products')}
                    variant="outline"
                    className="flex-1 border-gray-200 h-14 text-lg font-bold text-gray-600 hover:bg-gray-50 transition-all rounded-xl"
                  >
                    Continue Shopping
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6 py-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
                    <XCircle className="h-16 w-16 text-red-500" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-red-200 animate-pulse" />
                </div>
                
                <div className="text-center space-y-2">
                  <CardTitle className="text-3xl font-bold text-red-600">Payment Failed</CardTitle>
                  <p className="text-gray-500 text-lg">{error || 'Your payment could not be processed'}</p>
                </div>

                <div className="w-full bg-red-50 border border-red-100 rounded-2xl p-6 text-left space-y-4">
                  <p className="text-red-700 text-sm leading-relaxed">
                    If you were charged but see this message, please contact our support team with your payment reference:
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Reference Number</p>
                    <p className="font-mono text-red-600 font-bold text-lg select-all">{reference || 'N/A'}</p>
                  </div>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-4 pt-4">
                  <Button 
                    onClick={() => navigate('/checkout')} 
                    className="flex-1 bg-gray-900 text-white h-14 text-lg font-bold rounded-2xl hover:bg-gray-800"
                  >
                    Try Again
                  </Button>
                  <Button 
                    onClick={() => navigate('/dashboard')} 
                    variant="outline"
                    className="flex-1 border-gray-200 h-14 text-lg font-bold text-gray-600 rounded-2xl"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default PaystackSuccess;

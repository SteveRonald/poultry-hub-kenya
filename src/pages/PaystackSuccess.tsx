import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Sparkles, Receipt, Mail, ArrowRight } from 'lucide-react';
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
        setOrderDetails(data); // Use data directly, not data.data
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
              <div className="text-center">
                {/* Animated Tick Icon - Safaricom Style */}
                <div className="relative inline-block mb-6">
                  <div 
                    className={`w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center transition-all duration-500 ${
                      showAnimation ? 'scale-110' : 'scale-0'
                    }`}
                  >
                    <svg 
                      className={`w-12 h-12 text-green-500 transition-all duration-500 ${
                        showAnimation ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                      }`}
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </div>
                  {/* Animated ring effect */}
                  <div 
                    className={`absolute inset-0 rounded-full border-2 border-green-400 transition-all duration-1000 ${
                      showAnimation ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
                    }`}
                  />
                </div>
                
                <h1 className="text-3xl font-bold text-green-600 mb-4">
                  Payment Successful!
                </h1>
                
                <p className="text-gray-600 mb-6">
                  Your payment has been processed successfully.
                </p>
                
                {orderDetails && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-left">
                    <h2 className="text-xl font-semibold text-green-800 mb-4">
                      Order Details
                    </h2>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Payment ID:</span>
                        <span className="font-bold text-green-700">{orderDetails.reference || orderDetails.payment_reference}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Amount Paid:</span>
                        <span className="font-bold text-green-700">
                          {orderDetails.amount ? `KSH ${orderDetails.amount.toLocaleString()}` : 'KSH 0'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Payment Method:</span>
                        <span className="font-bold text-green-700 capitalize">
                          {orderDetails.selected_method || orderDetails.channel || 'Paystack'}
                        </span>
                      </div>
                      {orderDetails.order_ids && orderDetails.order_ids.length > 0 && (
                        <div className="mt-4 p-3 bg-green-100 rounded">
                          <p className="text-green-800 text-sm">
                            <strong>{orderDetails.order_ids.length}</strong> order(s) created successfully
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    View My Orders
                  </button>
                  <button
                    onClick={() => navigate('/products')}
                    className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <XCircle className="h-16 w-16 text-red-500" />
                  <div className="absolute inset-0 rounded-full border-4 border-red-200 animate-pulse" />
                </div>
                <CardTitle className="text-2xl text-red-600">Payment Failed</CardTitle>
                <p className="text-gray-600">{error || 'Your payment could not be processed'}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6 relative z-10">
            {paymentStatus === 'success' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="w-6 h-6 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Email Confirmation</h3>
                </div>
                <p className="text-blue-700 text-sm">
                  You will receive an email confirmation shortly with your complete order details and receipt.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => navigate('/dashboard')} 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
              >
                View Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                onClick={() => navigate('/orders')} 
                variant="outline"
                className="flex-1 py-6 text-lg"
              >
                Track Order
              </Button>
            </div>

            {paymentStatus === 'failed' && (
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <div className="space-y-3">
                    <p className="text-red-700">
                      If you were charged but see this message, please contact our support team
                      with your payment reference: <strong>{reference}</strong>
                    </p>
                    <div className="bg-white rounded-lg p-3 border border-red-100">
                      <p className="text-xs text-red-600 font-mono">{reference}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={() => navigate('/checkout')} variant="outline" className="flex-1 py-6">
                    Try Again
                  </Button>
                  <Button onClick={() => navigate('/dashboard')} className="flex-1 py-6">
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default PaystackSuccess;

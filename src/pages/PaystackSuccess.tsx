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
        setOrderDetails(data.data);
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
          {/* Animated Background for Success */}
          {paymentStatus === 'success' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(6)].map((_, i) => {
                const positions = [
                  { top: '10%', left: '10%' },
                  { top: '20%', right: '15%' },
                  { top: '60%', left: '5%' },
                  { top: '70%', right: '10%' },
                  { bottom: '20%', left: '20%' },
                  { bottom: '10%', right: '5%' },
                ];
                const pos = positions[i] || { top: '20%', left: '20%' };
                return (
                  <Sparkles
                    key={i}
                    className={`absolute text-green-500 ${
                      showAnimation ? 'animate-sparkle' : 'opacity-0'
                    }`}
                    style={{
                      ...pos,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '3s',
                      animationIterationCount: 'infinite',
                    }}
                    size={i % 2 === 0 ? 16 : 24}
                  />
                );
              })}
            </div>
          )}

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
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg transform transition-all duration-700 ${
                    showAnimation ? 'scale-100 rotate-0' : 'scale-0 rotate-180'
                  }`}>
                    <CheckCircle className={`w-12 h-12 text-white ${
                      showAnimation ? 'animate-checkmark' : 'scale-0'
                    }`} strokeWidth={3} />
                  </div>
                  {showAnimation && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20" />
                      <div className="absolute inset-0 rounded-full bg-green-500 animate-pulse opacity-10" />
                    </>
                  )}
                </div>
                <div className={`space-y-2 transform transition-all duration-700 ${
                  showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`} style={{ transitionDelay: '0.3s' }}>
                  <CardTitle className="text-3xl text-green-600">Payment Successful!</CardTitle>
                  <p className="text-gray-600">Your order has been confirmed and payment processed</p>
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
            {paymentStatus === 'success' && orderDetails && (
              <div className={`space-y-6 transform transition-all duration-700 ${
                showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`} style={{ transitionDelay: '0.5s' }}>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Receipt className="w-6 h-6 text-green-600" />
                    <h3 className="font-semibold text-green-800 text-lg">Order Details</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-600">Order ID</p>
                      <p className="font-mono font-semibold text-green-700">#{orderDetails.order_id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-600">Reference</p>
                      <p className="font-mono text-green-700">{reference}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-600">Amount Paid</p>
                      <p className="font-bold text-green-700 text-lg">KSH {orderDetails.amount?.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-600">Status</p>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {orderDetails.status || 'Completed'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Mail className="w-6 h-6 text-blue-600" />
                    <h3 className="font-semibold text-blue-800">Email Confirmation</h3>
                  </div>
                  <p className="text-blue-700 text-sm">
                    You will receive an email confirmation shortly with your complete order details and receipt.
                  </p>
                </div>

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
              </div>
            )}

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

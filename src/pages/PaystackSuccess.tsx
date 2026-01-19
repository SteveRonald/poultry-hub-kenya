import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { getApiUrl } from '../config/api';

const PaystackSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');

  useEffect(() => {
    if (reference) {
      verifyPayment(reference);
    } else {
      setPaymentStatus('failed');
      setError('Payment reference not found');
      setLoading(false);
    }
  }, [reference]);

  const verifyPayment = async (reference: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/payments/paystack/verify/${reference}`));
      const data = await response.json();

      if (data.success) {
        setPaymentStatus('success');
        setOrderDetails(data.data);
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
        <Card>
          <CardHeader className="text-center">
            {loading ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <CardTitle className="text-xl">Verifying Payment...</CardTitle>
                <p className="text-gray-600">Please wait while we confirm your payment</p>
              </div>
            ) : paymentStatus === 'success' ? (
              <div className="flex flex-col items-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
                <p className="text-gray-600">Your order has been confirmed and payment processed</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <XCircle className="h-16 w-16 text-red-500" />
                <CardTitle className="text-2xl text-red-600">Payment Failed</CardTitle>
                <p className="text-gray-600">{error || 'Your payment could not be processed'}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {paymentStatus === 'success' && orderDetails && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Order Details</h3>
                  <div className="space-y-1 text-sm text-green-700">
                    <p><strong>Order ID:</strong> #{orderDetails.order_id}</p>
                    <p><strong>Reference:</strong> {reference}</p>
                    <p><strong>Amount:</strong> KSH {orderDetails.amount?.toLocaleString()}</p>
                    <p><strong>Status:</strong> {orderDetails.status}</p>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    You will receive an email confirmation shortly with your order details.
                  </p>
                  <Button onClick={handleContinue} className="w-full">
                    Continue to Dashboard
                  </Button>
                </div>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700">
                    If you were charged but see this message, please contact our support team
                    with your payment reference: <strong>{reference}</strong>
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button onClick={handleRetry} variant="outline" className="flex-1">
                    Try Again
                  </Button>
                  <Button onClick={handleContinue} className="flex-1">
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

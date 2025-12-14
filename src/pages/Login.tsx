
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Shield, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { getApiUrl } from '../config/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP verification
  const [userEmail, setUserEmail] = useState('');
  const [countdown, setCountdown] = useState(0);
  const { login, user, fetchUser } = useAuth();
  const { mergeLocalCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    // Only show notification if there's a redirect param indicating user came from checkout/cart
    const redirectParam = searchParams.get('redirect');
    const adParam = searchParams.get('ad');
    
    // Check if there's a pending order in sessionStorage AND user came from checkout flow
    if (redirectParam && (redirectParam.includes('checkout') || redirectParam.includes('cart'))) {
      const pendingOrder = sessionStorage.getItem('pending_order');
      if (pendingOrder) {
        try {
          const orderContext = JSON.parse(pendingOrder);
          // Only show message if coming from advertisement click
          if (adParam && orderContext.source === 'advertisement') {
            toast.info('Please login to complete your order from the advertisement');
          } else if (redirectParam.includes('checkout') || redirectParam.includes('cart')) {
            toast.info('Please login to continue with your order');
          }
        } catch (e) {
          // Ignore parsing errors
        }
      } else if (redirectParam.includes('checkout') || redirectParam.includes('cart')) {
        // User came to checkout but no pending order - might have items in cart
        toast.info('Please login to continue with checkout');
      }
    }

    // Restore login OTP state from localStorage to prevent loss on page refresh
    const savedLoginState = localStorage.getItem('login_otp_state');
    if (savedLoginState) {
      try {
        const state = JSON.parse(savedLoginState);
        const now = Date.now();
        // Only restore if OTP was sent less than 10 minutes ago
        if (state.timestamp && (now - state.timestamp) < 600000) {
          setStep(2);
          setUserEmail(state.userEmail || '');
          setEmail(state.email || '');
          const remainingTime = Math.max(0, Math.floor((600000 - (now - state.timestamp)) / 1000));
          setCountdown(Math.min(remainingTime, state.countdown || 0));
        } else {
          // State is expired, clear it
          localStorage.removeItem('login_otp_state');
        }
      } catch (e) {
        // Ignore parsing errors
        localStorage.removeItem('login_otp_state');
      }
    }
  }, []);

  // Step 1: Validate credentials and send OTP
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/auth/send-login-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Login failed. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setUserEmail(data.user_email);
      setStep(2);
      setCountdown(30); // Start 30-second countdown before resend

      // Save login OTP state to localStorage to persist across page refreshes
      const loginState = {
        email: email.trim(),
        userEmail: data.user_email,
        countdown: 30,
        timestamp: Date.now()
      };
      localStorage.setItem('login_otp_state', JSON.stringify(loginState));

      toast.success('OTP sent to your email. Please check your inbox.');
    } catch (error) {
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and complete login
  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/auth/verify-login-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_email: userEmail, otp }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Invalid OTP. Please try again.');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
      // Clear login OTP state from localStorage after successful login
      localStorage.removeItem('login_otp_state');

      // Store token and user data
      localStorage.setItem('session_token', data.token);
      localStorage.setItem('token', data.token); // keep backward compatibility
      localStorage.setItem('user_data', JSON.stringify(data.user));

      // Ensure auth context is up-to-date before navigation
      try {
        await fetchUser();
      } catch (e) {
        // Non-fatal: proceed to navigate using the response data
        if (import.meta.env.DEV) console.error('fetchUser failed after OTP verify', e);
      }

      // Merge local storage cart with database cart after login
      try {
        await mergeLocalCart();
      } catch (e) {
        if (import.meta.env.DEV) console.error('Failed to merge local cart:', e);
      }

      toast.success('Login successful!');

      // Check for redirect parameter (checkout flow)
      const redirectParam = searchParams.get('redirect');
      
      if (redirectParam) {
        // Redirect to the specified page (e.g., checkout)
        navigate(decodeURIComponent(redirectParam));
        return;
      }

      // Check for pending order or product parameter (legacy support)
      const pendingOrder = sessionStorage.getItem('pending_order');
      const productParam = searchParams.get('product');
      const adParam = searchParams.get('ad');
      
      if (pendingOrder || productParam) {
        // Restore order context and redirect to products page
        if (productParam) {
          const redirectUrl = adParam 
            ? `/products?product=${productParam}&ad=${adParam}`
            : `/products?product=${productParam}`;
          navigate(redirectUrl);
        } else {
          navigate('/products');
        }
      } else {
        // Navigate based on user role
        if (data.user?.role === 'vendor') {
          navigate('/vendor-dashboard');
        } else if (data.user?.role === 'admin') {
          navigate('/control_90E-panel');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/auth/send-login-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        toast.error('Failed to resend OTP. Please try again.');
        setIsLoading(false);
        return;
      }

      setCountdown(30);
      setOtp('');

      // Update localStorage with new OTP state
      const loginState = {
        email: email.trim(),
        userEmail: userEmail,
        countdown: 30,
        timestamp: Date.now()
      };
      localStorage.setItem('login_otp_state', JSON.stringify(loginState));

      toast.success('OTP resent to your email');
    } catch (error) {
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back to credentials
  const handleBackToCredentials = () => {
    setStep(1);
    setOtp('');
    setUserEmail('');
    setCountdown(0);
    // Clear login OTP state when going back
    localStorage.removeItem('login_otp_state');
  };

  return (
    <div className="min-h-screen bg-beige dark:bg-gray-900">
      <Navbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-primary">
                {step === 1 ? 'Welcome Back' : 'Verify Your Identity'}
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                {step === 1 
                  ? 'Sign in to your PoultryHubKE account' 
                  : 'Enter the 6-digit code sent to your email'}
              </p>
            </CardHeader>
            <CardContent>
              {step === 1 ? (
                // Step 1: Credentials
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full btn-primary flex items-center justify-center"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Verify and Login
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                // Step 2: OTP Verification
                <form onSubmit={handleOTPSubmit} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      We've sent a 6-digit code to <strong>{email}</strong>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                      Verification Code
                    </label>
                    <Input
                      id="otp"
                      name="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      required
                      className="text-center text-lg tracking-widest font-mono"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full btn-primary flex items-center justify-center"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Verify & Login
                      </>
                    )}
                  </Button>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {countdown > 0 ? (
                        <span className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4" />
                          Resend in {countdown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          disabled={isLoading}
                          className="text-primary hover:underline font-medium disabled:text-gray-400"
                        >
                          Didn't receive the code? Resend
                        </button>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={handleBackToCredentials}
                      disabled={isLoading}
                      className="text-sm text-gray-500 hover:text-gray-700 underline disabled:text-gray-400"
                    >
                      Back to login
                    </button>
                  </div>
                </form>
              )}

              {step === 1 && (
                <div className="mt-6 text-center space-y-3">
                  <p className="text-gray-600 dark:text-gray-300">
                    <Link to="/forgot-password" className="text-primary hover:underline font-medium">
                      Forgot your password?
                    </Link>
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-primary hover:underline font-medium">
                      Sign up here
                    </Link>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;


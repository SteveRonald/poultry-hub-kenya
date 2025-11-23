import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, MapPin, Phone, CreditCard, Check } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import OrderSuccessModal from '../components/OrderSuccessModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
    payment_method: 'mpesa',
    payment_account_number: '',
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
      // Create orders for each item
      const orderPromises = checkoutItems.map((item) =>
        fetch(getApiUrl('/api/orders'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            product_id: item.product_id,
            quantity: item.quantity,
            shipping_address: formData.shipping_address.trim(),
            contact_phone: formData.contact_phone.trim(),
            payment_method: formData.payment_method,
            payment_account_number: formData.payment_account_number.trim(),
            notes: formData.notes.trim() || 'Order from checkout'
          })
        })
      );

      const responses = await Promise.all(orderPromises);
      const results = await Promise.all(responses.map(r => r.json()));

      // Check if all orders succeeded
      const failedOrders = results.filter(r => !r.success && r.success !== undefined);
      
      if (failedOrders.length > 0) {
        toast.error('Some orders failed. Please try again.');
        return;
      }

      // Clear cart after successful order
      if (user) {
        // Clear database cart
        await fetch(getApiUrl('/api/cart/clear'), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        refreshCart();
      } else {
        // Clear local cart
        localStorage.removeItem('local_cart');
      }

      // Extract order number from first successful order
      const firstOrder = results.find(r => r.order_number || r.order_id);
      if (firstOrder) {
        setOrderNumber(firstOrder.order_number || `#${firstOrder.order_id}`);
      }

      // Show success modal instead of immediate redirect
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-background">
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

        <h1 className="text-3xl font-bold text-primary mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Order Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="07XX XXX XXX"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => {
                        setFormData({ ...formData, payment_method: value, payment_account_number: '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="bank" disabled>Bank Transfer (Coming Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.payment_method === 'mpesa' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        M-Pesa Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="tel"
                        value={formData.payment_account_number}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, ''); // Only numbers
                          if (value.length <= 10) {
                            setFormData({ ...formData, payment_account_number: value });
                          }
                        }}
                        placeholder="07XX XXX XXX"
                        required
                        maxLength={10}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter your M-Pesa phone number (10 digits)</p>
                    </div>
                  )}

                  {formData.payment_method === 'bank' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank Account Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={formData.payment_account_number}
                        onChange={(e) => setFormData({ ...formData, payment_account_number: e.target.value })}
                        placeholder="Enter bank account number"
                        required
                        disabled
                      />
                      <p className="text-xs text-gray-500 mt-1">Bank transfer is coming soon</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Notes (Optional)
                    </label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any special instructions for delivery"
                      rows={2}
                    />
                  </div>

                  {!user && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Please login to complete your order. Your items will be saved.
                      </p>
                      <Button
                        type="button"
                        onClick={() => {
                          const currentParams = new URLSearchParams(searchParams);
                          const redirectUrl = `/checkout${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
                          navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
                        }}
                        className="mt-2"
                      >
                        Login to Continue
                      </Button>
                    </div>
                  )}

                  {user && (
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-lg"
                      disabled={loading || checkoutItems.length === 0}
                    >
                      {loading ? (
                        <span className="flex items-center gap-1">
                          <span>Placing Order</span>
                          <span className="animate-dots">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                          </span>
                        </span>
                      ) : 'Place Order'}
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
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
                      <span>KSH 0</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>KSH {totalAmount.toLocaleString()}</span>
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


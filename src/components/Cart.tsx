import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, MapPin, Phone, CreditCard } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
}

const Cart: React.FC<CartProps> = ({ isOpen, onClose }) => {
  const { cartItems, cartSummary, loading, updateCartItem, removeFromCart, clearCart, getLocalCart } = useCart();
  const { user } = useAuth();
  const [localCartItems, setLocalCartItems] = useState<any[]>([]);
  const [localCartTotal, setLocalCartTotal] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    shipping_address: '',
    contact_phone: '',
    payment_method: 'mpesa',
    payment_account_number: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Update local cart items when not logged in
  useEffect(() => {
    if (isOpen) {
      if (!user) {
        const localCart = getLocalCart();
        setLocalCartItems(localCart || []);
        const total = (localCart || []).reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
        setLocalCartTotal(total);
      } else {
        setLocalCartItems([]);
        setLocalCartTotal(0);
      }
    }
  }, [user, getLocalCart, isOpen]); // Re-check when cart opens

  const handleQuantityChange = async (cartId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    await updateCartItem(cartId, newQuantity);
  };

  const handleRemoveItem = async (cartId: number) => {
    await removeFromCart(cartId);
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please login to place an order');
      return;
    }

    if (!checkoutData.shipping_address.trim() || !checkoutData.contact_phone.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (checkoutData.payment_method === 'mpesa' && !checkoutData.payment_account_number.trim()) {
      toast.error('M-Pesa number is required');
      return;
    }

    if (checkoutData.payment_method === 'mpesa' && checkoutData.payment_account_number.length !== 10) {
      toast.error('M-Pesa number must be 10 digits');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(getApiUrl('/api/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(checkoutData)
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails but response is OK, order might still be created
        if (response.ok) {
          toast.warning('Order may have been placed, but we could not confirm. Please check your orders.');
          await clearCart(true);
          setShowCheckout(false);
          setCheckoutData({ shipping_address: '', contact_phone: '', payment_method: 'mpesa', payment_account_number: '', notes: '' });
          onClose();
          return;
        } else {
          throw jsonError;
        }
      }

      if (response.ok && data.success !== false) {
        const ordersCount = (data && (data.total_items ?? data.total_orders)) ?? 0;
        // Show appropriate message based on email status
        if (data.customer_email_sent === false) {
          toast.warning(data.message || `Order sent successfully, but we could not send the confirmation email. ${ordersCount} order(s) placed.`);
        } else {
          toast.success(data.message || `Orders created successfully! ${ordersCount} order(s) placed.`);
        }
        // Clear cart immediately in UI (backend also clears server-side)
        await clearCart(true);
        // Stagger a second toast so both are visible to the user
        setTimeout(() => {
          toast.success('Cart cleared.');
        },3000);
        setShowCheckout(false);
        setCheckoutData({ shipping_address: '', contact_phone: '', payment_method: 'mpesa', notes: '' });
        onClose();
      } else {
        // Order creation failed
        toast.error(data.error || data.message || 'Failed to place order. Please try again.');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      // Network error or other exception - don't assume order failed
      // Check if we can determine order status from error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('An error occurred while placing your order. Please check your orders to confirm if it was placed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-primary flex items-center">
              <ShoppingCart className="h-6 w-6 mr-2" />
              Shopping Cart
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {(user ? cartItems : localCartItems).length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Your cart is empty</h3>
              <p className="text-gray-500 mb-4">Add some products to get started!</p>
              <Button onClick={onClose} className="btn-primary">
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {!showCheckout ? (
                <>
                  {/* Cart Items */}
                  <div className="space-y-4">
                    {(user ? cartItems : localCartItems).map((item, index) => {
                      const cartId = user ? item.cart_id : `local_${index}`;
                      return (
                      <Card key={cartId} className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Product Image */}
                          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                            {item.image_url ? (
                              <img
                                src={getImageUrl(item.image_url.replace(/\\/g, '/'))}
                                alt={item.product_name}
                                className="w-full h-full object-cover rounded-lg"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="text-gray-400 text-xs text-center">
                                No Image
                              </div>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                            {item.category && <p className="text-sm text-gray-600 capitalize">{item.category}</p>}
                            {user && item.vendor_name && <p className="text-sm text-gray-500">Vendor: {item.vendor_name}</p>}
                            <p className="text-lg font-bold text-primary">KSH {Number(item.price).toFixed(2)}</p>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (user) {
                                  handleQuantityChange(item.cart_id, item.quantity - 1);
                                } else {
                                  // Update local cart
                                  const localCart = getLocalCart();
                                  const itemIndex = localCart.findIndex((i: any) => i.product_id === item.product_id);
                                  if (itemIndex >= 0 && localCart[itemIndex].quantity > 1) {
                                    localCart[itemIndex].quantity -= 1;
                                    localStorage.setItem('local_cart', JSON.stringify(localCart));
                                    setLocalCartItems([...localCart]);
                                    const total = localCart.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
                                    setLocalCartTotal(total);
                                    // Dispatch storage event to update Navbar count
                                    window.dispatchEvent(new Event('storage'));
                                  }
                                }
                              }}
                              disabled={loading || item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (user) {
                                  handleQuantityChange(item.cart_id, item.quantity + 1);
                                } else {
                                  // Update local cart
                                  const localCart = getLocalCart();
                                  const itemIndex = localCart.findIndex((i: any) => i.product_id === item.product_id);
                                  if (itemIndex >= 0) {
                                    localCart[itemIndex].quantity += 1;
                                    localStorage.setItem('local_cart', JSON.stringify(localCart));
                                    setLocalCartItems([...localCart]);
                                    const total = localCart.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
                                    setLocalCartTotal(total);
                                    // Dispatch storage event to update Navbar count
                                    window.dispatchEvent(new Event('storage'));
                                  }
                                }
                              }}
                              disabled={loading || (user && item.quantity >= item.stock_quantity)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Total Price */}
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-bold text-primary">
                              KSH {Number(user ? item.total_price : (item.price * item.quantity)).toFixed(2)}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (user) {
                                  handleRemoveItem(item.cart_id);
                                } else {
                                  // Remove from local cart
                                  const localCart = getLocalCart();
                                  const filtered = localCart.filter((i: any) => i.product_id !== item.product_id);
                                  localStorage.setItem('local_cart', JSON.stringify(filtered));
                                  setLocalCartItems(filtered);
                                  const total = filtered.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
                                  setLocalCartTotal(total);
                                }
                              }}
                              disabled={loading}
                              className="text-red-600 hover:text-red-700 mt-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                    })}
                  </div>

                  {/* Cart Summary */}
                  <Card className="bg-gray-50">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold">Total Items:</span>
                        <span className="text-lg font-bold">
                          {user 
                            ? cartSummary.items_count 
                            : localCartItems.length
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-xl font-bold">Total Amount:</span>
                        <span className="text-2xl font-bold text-primary">
                          KSH {Number(user ? cartSummary.total_amount : localCartTotal).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => {
                            if (!user) {
                              // Navigate to checkout page for non-logged-in users
                              onClose();
                              window.location.href = '/checkout';
                            } else {
                              setShowCheckout(true);
                            }
                          }}
                          className="flex-1 btn-primary"
                          disabled={loading}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          {user ? 'Proceed to Checkout' : 'Go to Checkout'}
                        </Button>
                        <Button
                          onClick={() => {
                            if (user) {
                              clearCart();
                            } else {
                              // Clear local cart
                              localStorage.removeItem('local_cart');
                              setLocalCartItems([]);
                              setLocalCartTotal(0);
                              toast.success('Cart cleared');
                            }
                          }}
                          variant="outline"
                          disabled={loading}
                        >
                          Clear Cart
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                /* Checkout Form */
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Button
                      onClick={() => setShowCheckout(false)}
                      variant="outline"
                      size="sm"
                    >
                      ← Back to Cart
                    </Button>
                    <h3 className="text-xl font-semibold">Checkout</h3>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MapPin className="h-5 w-5 mr-2" />
                        Shipping Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label htmlFor="shipping_address" className="block text-sm font-medium text-gray-700 mb-1">
                          Shipping Address *
                        </label>
                        <Textarea
                          id="shipping_address"
                          value={checkoutData.shipping_address}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, shipping_address: e.target.value }))}
                          placeholder="Enter your complete shipping address..."
                          rows={3}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Contact Phone *
                        </label>
                        <Input
                          id="contact_phone"
                          type="tel"
                          value={checkoutData.contact_phone}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, contact_phone: e.target.value }))}
                          placeholder="Enter your phone number..."
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 mb-1">
                          Payment Method *
                        </label>
                        <select
                          id="payment_method"
                          value={checkoutData.payment_method}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, payment_method: e.target.value, payment_account_number: '' }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          required
                        >
                          <option value="mpesa">M-Pesa</option>
                          <option value="bank" disabled>Bank Transfer (Coming Soon)</option>
                        </select>
                      </div>

                      {checkoutData.payment_method === 'mpesa' && (
                        <div>
                          <label htmlFor="payment_account_number" className="block text-sm font-medium text-gray-700 mb-1">
                            M-Pesa Number <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="payment_account_number"
                            type="tel"
                            value={checkoutData.payment_account_number}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, ''); // Only numbers
                              if (value.length <= 10) {
                                setCheckoutData(prev => ({ ...prev, payment_account_number: value }));
                              }
                            }}
                            placeholder="07XX XXX XXX"
                            required
                            maxLength={10}
                          />
                          <p className="text-xs text-gray-500 mt-1">Enter your M-Pesa phone number (10 digits)</p>
                        </div>
                      )}

                      {checkoutData.payment_method === 'bank' && (
                        <div>
                          <label htmlFor="payment_account_number" className="block text-sm font-medium text-gray-700 mb-1">
                            Bank Account Number <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="payment_account_number"
                            type="text"
                            value={checkoutData.payment_account_number}
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, payment_account_number: e.target.value }))}
                            placeholder="Enter bank account number"
                            required
                            disabled
                          />
                          <p className="text-xs text-gray-500 mt-1">Bank transfer is coming soon</p>
                        </div>
                      )}

                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                          Order Notes (Optional)
                        </label>
                        <Textarea
                          id="notes"
                          value={checkoutData.notes}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Any special instructions or notes..."
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Order Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {cartItems.map((item) => (
                          <div key={item.cart_id} className="flex justify-between">
                            <span className="text-sm">{item.product_name} x {item.quantity}</span>
                            <span className="text-sm font-medium">KSH {Number(item.total_price).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t pt-2 mt-4">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total:</span>
                            <span className="text-primary">KSH {Number(cartSummary.total_amount).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex space-x-3">
                    
                    <Button
                      onClick={handleCheckout}
                      className="flex-1 btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? 'Placing Order...' : 'Place Order'}
                    </Button>
                    <Button
                      onClick={() => setShowCheckout(false)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Cart;

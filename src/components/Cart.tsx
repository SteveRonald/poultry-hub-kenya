import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getApiUrl, getImageUrl } from '../config/api';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
}

const Cart: React.FC<CartProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { cartItems, cartSummary, loading, updateCartItem, removeFromCart, clearCart, getLocalCart } = useCart();
  const { user } = useAuth();
  const [localCartItems, setLocalCartItems] = useState<any[]>([]);
  const [localCartTotal, setLocalCartTotal] = useState(0);
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
    
    if (isOpen) {
      fetchDeliverySettings();
    }
  }, [isOpen]);

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

  const handleQuantityChange = async (cartId: number | string, newQuantity: number) => {
    const item = currentItems.find(i => (user ? i.cart_id : `local_${currentItems.indexOf(i)}`) === cartId);
    if (!item) return;

    const minQty = item.minimum_order_quantity || 1;

    if (newQuantity < minQty) {
      toast.error(`Minimum order for this product is ${minQty} ${item.unit || 'unit'}(s)`);
      return;
    }

    if (user && typeof cartId === 'number') {
      await updateCartItem(cartId, newQuantity);
    } else {
      // Update local cart
      const localCart = getLocalCart();
      const itemIndex = typeof cartId === 'string' ? parseInt(cartId.split('_')[1]) : -1;
      
      if (itemIndex > -1 && localCart[itemIndex]) {
        localCart[itemIndex].quantity = newQuantity;
        localStorage.setItem('local_cart', JSON.stringify(localCart));
        // Force re-render of local cart items
        const total = localCart.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
        setLocalCartItems([...localCart]);
        setLocalCartTotal(total);
      }
    }
  };

  const handleRemoveItem = async (cartId: number) => {
    await removeFromCart(cartId);
  };

  if (!isOpen) return null;

  const currentItems = user ? cartItems : localCartItems;
  const subtotal = user ? cartSummary.total_amount : localCartTotal;
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;
  const actualDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  const currentTotal = subtotal + actualDeliveryFee;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <Card className="flex h-[min(90vh,760px)] flex-col border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-white pb-4 dark:bg-gray-800">
            <CardTitle className="flex items-center text-xl">
              <ShoppingCart className="h-6 w-6 mr-2" />
              Your Cart ({currentItems.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {currentItems.length === 0 ? (
              <div className="flex-1 px-6 py-12 text-center">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">Your cart is empty</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Add some products to get started!</p>
                <Button onClick={onClose} className="btn-primary">
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Cart Items */}
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-4 pr-1">
                  {currentItems.map((item, index) => {
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
                                  (e.target as HTMLImageElement).src = '/placeholder-product.jpg';
                                }}
                              />
                            ) : (
                              <div className="text-gray-400 text-xs text-center">No Image</div>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{item.product_name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {item.unit ? `Per ${item.unit}` : ''}
                            </p>
                            {item.minimum_order_quantity > 1 && (
                              <p className="text-xs text-orange-600 font-medium mt-0.5">
                                Min Order: {item.minimum_order_quantity}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-lg font-bold text-primary">
                                KSH {item.price.toLocaleString()}
                              </span>
                              
                              {/* Quantity Controls */}
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuantityChange(cartId, item.quantity - 1)}
                                  disabled={loading}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuantityChange(cartId, item.quantity + 1)}
                                  disabled={loading}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(cartId)}
                              disabled={loading}
                              className="text-red-500 hover:text-red-700 mt-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  </div>
                </div>

                {/* Cart Summary */}
                <Card className="rounded-none border-x-0 border-b-0 border-t bg-white dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>KSH {Number(subtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Delivery</span>
                        {isFreeDelivery ? (
                          <span className="text-green-600">FREE</span>
                        ) : (
                          <span>KSH {deliveryFee.toFixed(2)}</span>
                        )}
                      </div>
                      {!isFreeDelivery && freeDeliveryThreshold > 0 && (
                        <p className="text-xs text-gray-500">
                          Add KSH {(freeDeliveryThreshold - subtotal).toFixed(0)} more for free delivery
                        </p>
                      )}
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Total Amount:</span>
                        <span className="text-2xl font-bold text-primary">
                          KSH {Number(currentTotal).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => {
                            // Navigate to checkout page for all users
                            onClose();
                            navigate('/checkout');
                          }}
                          className="flex-1 btn-primary"
                          disabled={loading}
                        >
                          Proceed to Checkout
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
                            }
                            setTimeout(() => {
                              toast.success('Cart cleared.');
                            }, 3000);
                          }}
                          variant="outline"
                          disabled={loading}
                        >
                          Clear Cart
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Cart;

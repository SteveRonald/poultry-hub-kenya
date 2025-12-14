import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

interface ChatButtonProps {
  productId: string;
  vendorId?: number | string;
  vendorUserId?: number | string;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const ChatButton: React.FC<ChatButtonProps> = ({ 
  productId, 
  vendorId,
  vendorUserId,
  className = '',
  variant = 'ghost',
  size = 'sm'
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Hide button if:
  // 1. User is a vendor viewing their own product (vendorUserId === user.id)
  // Show button if:
  // - User is not logged in (will redirect to login)
  // - User is customer
  // - User is admin
  // - User is vendor viewing another vendor's product
  const shouldShowButton = () => {
    // If no user, show button (will redirect to login on click)
    if (!user) return true;
    
    // Admins can always chat
    if (user.role === 'admin') return true;
    
    // Customers can always chat
    if (user.role === 'customer') return true;
    
    // Vendors: only show if it's NOT their own product
    if (user.role === 'vendor') {
      // Get the vendor's user_id for this product
      const productVendorUserId = vendorUserId;
      const currentUserId = user.id;
      
      if (!productVendorUserId || !currentUserId) {
        // If we can't determine ownership, hide button (safer default for vendors)
        return false;
      }
      
      // Convert both to strings for comparison (handle both string and number IDs)
      const productVendorIdStr = String(productVendorUserId).trim();
      const currentUserIdStr = String(currentUserId).trim();
      
      // Hide if vendor is viewing their own product
      if (productVendorIdStr === currentUserIdStr) {
        return false;
      }
      
      // Show if vendor is viewing another vendor's product
      return true;
    }
    
    return true;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      // Redirect to login
      navigate('/login', { state: { returnTo: window.location.pathname } });
      return;
    }

    // Navigate to chat page
    navigate(`/chat/${productId}`, { 
      state: { 
        vendorId: vendorUserId || vendorId,
        returnTo: window.location.pathname 
      } 
    });
  };

  // Don't render button if vendor is viewing their own product
  if (!shouldShowButton()) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`flex items-center justify-center ${className}`}
      aria-label="Chat with vendor"
      title="Chat with vendor"
    >
      <MessageSquare className="h-4 w-4 mr-2 text-primary" />
      Chat with Vendor
    </Button>
  );
};

export default ChatButton;


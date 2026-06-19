import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, ShoppingCart, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { getApiUrl } from '../config/api';
import Cart from './Cart';
import Logo from './Logo';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const [showCart, setShowCart] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cartSummary, getLocalCart } = useCart();
  const { theme, toggleTheme } = useTheme();
  const [localCartCount, setLocalCartCount] = useState(0);

  // Update local cart count for non-logged-in users
  useEffect(() => {
    if (!user) {
      const updateCount = () => {
        // Call getLocalCart directly - it's a simple function that reads localStorage
        // No need to include it in dependencies as it doesn't change
        const localCart = getLocalCart();
        // Count unique products, not total quantity
        const uniqueProducts = localCart.length;
        setLocalCartCount(uniqueProducts);
      };
      
      updateCount();
      
      // Listen for storage changes to update count
      const handleStorageChange = () => {
        updateCount();
      };
      
      window.addEventListener('storage', handleStorageChange);
      // Also check periodically for same-tab updates
      const interval = setInterval(updateCount, 1000);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
      };
    } else {
      setLocalCartCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Removed getLocalCart from dependencies to prevent constant re-renders

  // Debug logging for mobile (disabled for security)
  // useEffect(() => {
  //   if (import.meta.env.DEV) {
  //     console.log('Navbar - User:', user);
  //     console.log('Navbar - Cart Summary:', cartSummary);
  //   }
  // }, [user, cartSummary]);

  // Check for admin session
  useEffect(() => {
    const adminToken = localStorage.getItem('admin_session_token');
    const adminData = localStorage.getItem('admin_info');
    if (adminToken && adminData) {
      try {
        setAdminInfo(JSON.parse(adminData));
      } catch (e) {
        // Invalid admin data, clear it
        localStorage.removeItem('admin_session_token');
        localStorage.removeItem('admin_info');
      }
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAdminLogout = async () => {
    const token = localStorage.getItem('admin_session_token');
    if (token) {
      try {
        await fetch(getApiUrl('/api/admin/logout'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Admin logout API call failed:', error);
        }
      }
    }
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_info');
    setAdminInfo(null);
    navigate('/control_90E-panel');
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/products', label: 'Products' },
    { path: '/training', label: 'Training' },
    { path: '/blog', label: 'Blog' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <>
    <nav className="bg-white dark:bg-gray-900 shadow-lg sticky top-0 z-50">
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 md:h-24">
          {/* Logo - Left side */}
          <div className="flex items-center flex-shrink-0">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <Logo size="md" showText={true} />
            </Link>
          </div>

          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center justify-center flex-1 space-x-6 lg:space-x-8 px-4">
            {navLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive(path)
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary font-semibold'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* User Menu - Right side */}
          <div className="hidden md:flex items-center flex-shrink-0 space-x-4">
            {/* Dark Mode Toggle - Always visible */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="flex items-center space-x-2"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            {adminInfo ? (
              <div className="flex items-center space-x-4">
                <Link to="/admin-dashboard">
                  <Button variant="outline" size="sm" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Admin: {adminInfo.full_name}</span>
                  </Button>
                </Link>
                <Button onClick={handleAdminLogout} variant="destructive" size="sm" className="flex items-center space-x-2">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                {/* Cart Icon */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCart(true)}
                  className="relative flex items-center space-x-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cart</span>
                  {cartSummary.items_count > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartSummary.items_count}
                    </span>
                  )}
                </Button>
                
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>{user.name}</span>
                  </Button>
                </Link>
                <Button onClick={handleLogout} variant="destructive" size="sm" className="flex items-center space-x-2">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                {/* Cart Icon for non-logged-in users */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCart(true)}
                  className="relative flex items-center space-x-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cart</span>
                  {localCartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {localCartCount}
                    </span>
                  )}
                </Button>
                <Link to="/login">
                  <Button variant="outline" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button className="btn-primary" size="sm">Register</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button and cart */}
          <div className="md:hidden flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>
            {/* Cart button for mobile header - show for all users */}
            <button
              onClick={() => setShowCart(true)}
              className="relative text-gray-700 dark:text-gray-300 hover:text-primary"
            >
              <ShoppingCart className="h-6 w-6" />
              {(user ? cartSummary.items_count : localCartCount) > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {user ? cartSummary.items_count : localCartCount}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 dark:text-gray-300 hover:text-primary"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>


      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`block px-3 py-2 text-base font-medium transition-colors ${
                  isActive(path)
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-900 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => setIsOpen(false)}
              >
                {label}
              </Link>
            ))}
            {adminInfo ? (
              <>
                <Link
                  to="/admin-dashboard"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                >
                  Admin Dashboard
                </Link>
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  Admin: {adminInfo.full_name}
                </div>
                <button
                  onClick={handleAdminLogout}
                  className="w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : user ? (
              <>
                {/* Cart Button for Mobile */}
                <button
                  onClick={() => {
                    setShowCart(true);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-base font-medium text-gray-900 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cart</span>
                  {cartSummary.items_count > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartSummary.items_count}
                    </span>
                  )}
                </button>
                
                <Link
                  to="/dashboard"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                {/* Cart Button for Mobile - non-logged-in */}
                <button
                  onClick={() => {
                    setShowCart(true);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-base font-medium text-gray-900 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center space-x-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cart</span>
                  {localCartCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {localCartCount}
                    </span>
                  )}
                </button>
                <Link
                  to="/login"
                  className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2 text-base font-medium text-gray-900 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setIsOpen(false)}
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
    
    {/* Cart Modal */}
    <Cart isOpen={showCart} onClose={() => setShowCart(false)} />
    </>
  );
};

export default Navbar;

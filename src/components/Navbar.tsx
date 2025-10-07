import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Egg, User, LogOut, ShoppingCart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Button } from './ui/button';
import { getApiUrl } from '../config/api';
import Cart from './Cart';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const [showCart, setShowCart] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cartSummary } = useCart();

  // Debug logging for mobile
  useEffect(() => {
    console.log('Navbar - User:', user);
    console.log('Navbar - Cart Summary:', cartSummary);
  }, [user, cartSummary]);

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
        console.error('Admin logout API call failed:', error);
      }
    }
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_info');
    setAdminInfo(null);
    navigate('/admin-login');
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
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-primary text-white p-2 rounded-lg">
                <Egg className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold text-primary">PoultryHubKenya (KE)</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(path)
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-700 hover:text-primary'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
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
                  {cartSummary.total_items > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartSummary.total_items}
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
          <div className="md:hidden flex items-center space-x-2">
            {/* Cart button for mobile header */}
            {user && (
              <button
                onClick={() => setShowCart(true)}
                className="relative text-gray-700 hover:text-primary"
              >
                <ShoppingCart className="h-6 w-6" />
                {cartSummary.total_items > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartSummary.total_items}
                  </span>
                )}
              </button>
            )}
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 hover:text-primary"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>


      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`block px-3 py-2 text-base font-medium transition-colors ${
                  isActive(path)
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-700 hover:text-primary hover:bg-gray-50'
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
                <div className="px-3 py-2 text-sm text-gray-500">
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
                  className="w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 flex items-center space-x-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cart</span>
                  {cartSummary.total_items > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartSummary.total_items}
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
                <Link
                  to="/login"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50"
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

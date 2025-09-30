
import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">PoultryConnect KE</h3>
            <p className="text-gray-200 mb-4">
              Kenya's premier poultry marketplace connecting farmers, vendors, and customers. 
              Quality poultry products from trusted sources across the country.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://www.facebook.com/profile.php?id=100085312746341" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Follow us on Facebook"
                aria-label="Follow us on Facebook"
              >
                <Facebook className="h-6 w-6 text-gray-200 hover:text-accent cursor-pointer transition-colors" />
              </a>
              <a 
                href="https://x.com/Stevegmail98" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Follow us on Twitter"
                aria-label="Follow us on Twitter"
              >
                <Twitter className="h-6 w-6 text-gray-200 hover:text-accent cursor-pointer transition-colors" />
              </a>
              <a 
                href="https://www.instagram.com/steve_ronald54?igsh=YzljYTk1ODg3Zg==" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Follow us on Instagram"
                aria-label="Follow us on Instagram"
              >
                <Instagram className="h-6 w-6 text-gray-200 hover:text-accent cursor-pointer transition-colors" />
              </a>
            </div>
          </div>

          {/* Navigation Links */}

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/products" className="text-gray-200 hover:text-accent transition-colors">Products</Link></li>
              <li><Link to="/training" className="text-gray-200 hover:text-accent transition-colors">Training</Link></li>
              <li><Link to="/blog" className="text-gray-200 hover:text-accent transition-colors">Blog</Link></li>
              <li><Link to="/contact" className="text-gray-200 hover:text-accent transition-colors">Contact</Link></li>
              <li><Link to="/register" className="text-gray-200 hover:text-accent transition-colors">Become a Vendor</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span className="text-gray-200">+254 799 422 635</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span className="text-gray-200">info@poultryconnect.ke</span>
              </li>
              <li className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span className="text-gray-200">Eldoret, Kenya</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-600 mt-8 pt-8 text-center">
          <p className="text-gray-200">
            &copy; 2025 PoultryConnect KE. All rights reserved. Empowering Kenya's poultry industry.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

import React, { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Button } from './ui/button';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber?: string;
}

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ isOpen, onClose, orderNumber }) => {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger animation after a brief delay
      setTimeout(() => setShowAnimation(true), 100);
    } else {
      setShowAnimation(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 sm:p-12 max-w-md w-full mx-4 transform transition-all">
        {/* Animated Stars Background */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          {[...Array(8)].map((_, i) => {
            const positions = [
              { top: '10%', left: '10%' },
              { top: '15%', right: '15%' },
              { top: '50%', left: '5%' },
              { top: '50%', right: '5%' },
              { bottom: '15%', left: '15%' },
              { bottom: '10%', right: '10%' },
              { top: '30%', left: '50%' },
              { bottom: '30%', right: '50%' },
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
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '2.5s',
                  animationIterationCount: 'infinite',
                }}
                size={i % 2 === 0 ? 20 : 28}
              />
            );
          })}
        </div>

        {/* Main Content */}
        <div className="relative z-10 text-center">
          {/* Success Icon */}
          <div className="relative inline-block mb-6">
            <div
              className={`w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg transform transition-all duration-500 ${
                showAnimation ? 'scale-100 rotate-0' : 'scale-0 rotate-180'
              }`}
            >
              <Check
                className={`w-12 h-12 sm:w-16 sm:h-16 text-white ${
                  showAnimation ? 'animate-checkmark' : 'scale-0'
                }`}
                strokeWidth={4}
              />
            </div>
            
            {/* Pulsing ring effect */}
            {showAnimation && (
              <>
                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20" />
                <div className="absolute inset-0 rounded-full bg-green-500 animate-pulse opacity-10" />
              </>
            )}
          </div>

          {/* Success Message */}
          <h2
            className={`text-3xl sm:text-4xl font-bold text-green-600 mb-3 transform transition-all duration-500 ${
              showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: '0.2s' }}
          >
            Order Placed!
          </h2>

          {orderNumber && (
            <p
              className={`text-sm sm:text-base text-gray-600 mb-6 transform transition-all duration-500 ${
                showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              style={{ transitionDelay: '0.3s' }}
            >
              Order #{orderNumber}
            </p>
          )}

          <p
            className={`text-base sm:text-lg text-gray-700 mb-2 transform transition-all duration-500 ${
              showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: '0.4s' }}
          >
            Order details emailed to you
          </p>
          <p
            className={`text-sm text-gray-600 mb-8 transform transition-all duration-500 ${
              showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: '0.45s' }}
          >
            You can view/track your order in the dashboard
          </p>

          {/* Action Button */}
          <Button
            onClick={onClose}
            className={`w-full sm:w-auto px-8 py-6 text-lg bg-green-600 hover:bg-green-700 transform transition-all duration-500 ${
              showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: '0.5s' }}
          >
            View Dashboard
          </Button>
        </div>
      </div>

    </div>
  );
};

export default OrderSuccessModal;


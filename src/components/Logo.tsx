import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-14 w-14',
    lg: 'h-24 w-24'
  };

  const textSizeClasses = {
    sm: 'text-sm sm:text-lg',
    md: 'text-base sm:text-xl',
    lg: 'text-lg sm:text-2xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`flex items-center justify-center ${size === 'lg' ? 'w-28 h-28' : size === 'md' ? 'w-16 h-16' : 'w-14 h-14'}`}>
        <img 
          src="/logo.png" 
          alt="Poultry Hub Kenya Logo" 
          className={`${sizeClasses[size]} object-contain`}
        />
      </div>
      {showText && (
        <span className={`font-bold text-primary ${textSizeClasses[size]} block`}>
          PoultryHubKenya (KE)
        </span>
      )}
    </div>
  );
};

export default Logo;

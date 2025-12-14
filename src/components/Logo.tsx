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
    <div className={`flex items-center space-x-1 sm:space-x-2 md:space-x-3 ${className}`}>
      <div className={`flex items-center justify-center ${size === 'lg' ? 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28' : size === 'md' ? 'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16' : 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14'}`}>
        <img 
          src="/logo.png" 
          alt="KukuSoko Logo" 
          className={`${sizeClasses[size]} object-contain`}
        />
      </div>
      {showText && (
        <span className={`font-bold text-primary ${textSizeClasses[size]} block whitespace-nowrap`}>
          <span className="hidden md:inline">KukuSoko</span>
          <span className="md:hidden">KukuSoko</span>
        </span>
      )}
    </div>
  );
};

export default Logo;

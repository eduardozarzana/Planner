
import React, { ReactNode } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = "font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ease-in-out inline-flex items-center justify-center";
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // Updated variant styles for green/yellow theme
  const variantStyles = {
    primary: 'bg-yellow-400 text-green-900 hover:bg-yellow-500 focus:ring-yellow-300',
    secondary: 'bg-green-200 text-green-800 hover:bg-green-300 focus:ring-green-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500', // Using emerald for success to differentiate from main green
    warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400', // Using amber for warning
    ghost: 'bg-transparent text-yellow-600 hover:bg-yellow-100 focus:ring-yellow-500',
  };
  
  const disabledStyles = "opacity-50 cursor-not-allowed";

  // Determine spinner color based on button variant for contrast
  let spinnerColorClass = 'text-white'; // Default for dark backgrounds
  if (variant === 'primary') {
    spinnerColorClass = 'text-green-900';
  } else if (variant === 'secondary' || variant === 'ghost') {
    spinnerColorClass = 'text-yellow-600';
  }


  return (
    <button
      type="button"
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabled || isLoading ? disabledStyles : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${spinnerColorClass}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {leftIcon && !isLoading && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && !isLoading && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default Button;
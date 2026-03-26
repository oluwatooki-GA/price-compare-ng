import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const Button = ({
  variant = 'primary',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) => {
  const baseStyles = 'px-6 py-3 cursor-pointer rounded-lg font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-0.5 active:shadow-inner';
  
  const variantStyles = {
    primary: 'bg-[#1edc6a] text-[#0A0A0A] hover:bg-[#17c55e] focus:ring-[#1edc6a] shadow-lg hover:shadow-md active:shadow-sm',
    secondary: 'bg-[#262626] text-white hover:bg-[#1a1a1a] focus:ring-[#262626] border border-[#262626] shadow-lg hover:shadow-md active:shadow-sm',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 shadow-lg hover:shadow-md active:shadow-sm',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
};

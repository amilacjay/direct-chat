import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'gray' | 'green' | 'red' | 'yellow';
  className?: string;
}

const variantMap = {
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'gray', className = '' }) => {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${variantMap[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

import React from 'react';

interface M3CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'elevated' | 'outlined' | 'filled';
  onClick?: () => void;
}

export const M3Card: React.FC<M3CardProps> = ({
  children,
  className = '',
  variant = 'outlined',
  onClick,
}) => {
  const variantStyles = {
    elevated: 'bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800/90',
    outlined: 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 shadow-xs',
    filled: 'bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60',
  };

  const interactiveStyle = onClick
    ? 'cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 active:scale-[0.99]'
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-5 md:p-6 ${variantStyles[variant]} ${interactiveStyle} ${className}`}
    >
      {children}
    </div>
  );
};

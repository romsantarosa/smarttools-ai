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
    elevated: 'bg-white dark:bg-tc-surface-2 shadow-sm border border-slate-200/80 dark:border-tc-border',
    outlined: 'bg-white dark:bg-tc-surface-2 border border-slate-200/90 dark:border-tc-border shadow-xs',
    filled: 'bg-slate-50/90 dark:bg-tc-surface-1/60 border border-slate-200/60 dark:border-tc-border-soft',
  };

  const interactiveStyle = onClick
    ? 'cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-tc-accent-line transition-all duration-200 active:scale-[0.99]'
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

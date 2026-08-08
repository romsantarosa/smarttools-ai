import React from 'react';

export type BadgeVariant = 'error' | 'warning' | 'success' | 'info' | 'neutral';

interface M3BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  className?: string;
}

export const M3Badge: React.FC<M3BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  const variantStyles = {
    error: 'bg-red-100 text-red-800 dark:bg-tc-critical-soft dark:text-tc-critical border border-red-200 dark:border-tc-critical-line',
    warning: 'bg-amber-100 text-amber-800 dark:bg-tc-warning-soft dark:text-tc-warning border border-amber-200 dark:border-tc-warning-line',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-tc-good-soft dark:text-tc-good border border-emerald-200 dark:border-tc-good-line',
    info: 'bg-blue-100 text-blue-800 dark:bg-tc-accent-soft dark:text-tc-accent border border-blue-200 dark:border-tc-border',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-tc-surface-1 dark:text-tc-ink-2 border border-slate-200 dark:border-tc-border',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs rounded-full font-medium',
    md: 'px-2.5 py-1 text-xs rounded-full font-semibold',
    lg: 'px-3 py-1.5 text-sm rounded-full font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};

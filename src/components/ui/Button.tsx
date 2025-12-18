import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:ring-offset-surface-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          
          // Variants
          variant === 'primary' && [
            'bg-accent-600 text-white',
            'hover:bg-accent-500 active:bg-accent-700',
            'shadow-lg shadow-accent-600/25',
          ],
          variant === 'secondary' && [
            'bg-surface-700 text-surface-100 border border-surface-600',
            'hover:bg-surface-600 active:bg-surface-800',
          ],
          variant === 'ghost' && [
            'bg-transparent text-surface-300',
            'hover:bg-surface-800 hover:text-surface-100',
          ],
          variant === 'danger' && [
            'bg-red-600 text-white',
            'hover:bg-red-500 active:bg-red-700',
          ],
          
          // Sizes
          size === 'sm' && 'px-3 py-1.5 text-sm',
          size === 'md' && 'px-4 py-2 text-sm',
          size === 'lg' && 'px-6 py-3 text-base',
          
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };


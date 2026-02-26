import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

export interface SelectOptionProps extends React.OptionHTMLAttributes<HTMLOptionElement> {}

export const SelectOption = React.forwardRef<HTMLOptionElement, SelectOptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <option
        ref={ref}
        className={cn('bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300', className)}
        {...props}
      />
    );
  }
);
SelectOption.displayName = 'SelectOption';

export interface SelectGroupProps extends React.HTMLAttributes<HTMLOptGroupElement> {
  label: string;
}

export const SelectGroup = React.forwardRef<HTMLOptGroupElement, SelectGroupProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <optgroup
        ref={ref}
        label={label}
        className={cn('bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-bold', className)}
        {...props}
      />
    );
  }
);
SelectGroup.displayName = 'SelectGroup';

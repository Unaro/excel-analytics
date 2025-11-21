import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "border-transparent bg-gray-100 text-slate-900 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700",
    outline: "text-slate-950 dark:text-slate-50 border-slate-200 dark:border-slate-800",
    success: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    warning: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
      {children}
    </div>
  );
}
// src/components/common/BadgeNumber.tsx
interface BadgeNumberProps {
  number: number;
  color?: string;
  className?: string;
}

export function BadgeNumber({ number, color = '#3b82f6', className }: BadgeNumberProps) {
  return (
    <div 
      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${className}`}
      style={{ backgroundColor: color }}
    >
      #{number}
    </div>
  );
}

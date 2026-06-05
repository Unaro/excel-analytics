import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface SortIconProps {
  active: boolean;
  direction: 'asc' | 'desc';
}

export function SortIcon({ active, direction }: SortIconProps) {
  if (!active) return <ArrowUpDown size={12} className="opacity-30" />;
  return direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}
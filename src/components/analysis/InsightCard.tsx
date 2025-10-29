import { AlertCircle, CheckCircle, Info, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface InsightCardProps {
  type: 'info' | 'success' | 'warning' | 'danger' | 'trend-up' | 'trend-down';
  title: string;
  description: string;
  value?: string;
}

export default function InsightCard({ type, title, description, value }: InsightCardProps) {
  const config = {
    info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', iconColor: 'text-blue-600' },
    success: { icon: CheckCircle, bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900', iconColor: 'text-green-600' },
    warning: { icon: AlertTriangle, bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-900', iconColor: 'text-yellow-600' },
    danger: { icon: AlertCircle, bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900', iconColor: 'text-red-600' },
    'trend-up': { icon: TrendingUp, bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-900', iconColor: 'text-emerald-600' },
    'trend-down': { icon: TrendingDown, bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900', iconColor: 'text-orange-600' },
  }[type];

  const Icon = config.icon;

  return (
    <div className={`${config.bg} border-2 ${config.border} rounded-lg p-4 ${config.text}`}>
      <div className="flex items-start gap-3">
        <Icon size={24} className={`${config.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h4 className="font-bold mb-1">{title}</h4>
          <p className="text-sm">{description}</p>
          {value && (
            <p className="text-lg font-bold mt-2">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

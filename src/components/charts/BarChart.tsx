'use client';

import { COLORS } from '@/lib/storage';
import { ChartDataPoint } from '@/types/dashboard';
import { 
  Bar, 
  BarChart as RechartsBarChart, 
  CartesianGrid, 
  Cell, 
  Legend, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from 'recharts';

interface BarChartProps {
  data: ChartDataPoint[];
  indicators: string[] | string;
  height?: number;
  showLegend?: boolean;
  stacked?: boolean;
}

export default function BarChart({ 
  data, 
  indicators, 
  height = 400,
  showLegend = true,
  stacked = false 
}: BarChartProps) {
  const isMultiple = Array.isArray(indicators);
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart 
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="name" 
          angle={-45} 
          textAnchor="end" 
          height={100}
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px'
          }}
          formatter={(value: number) => value.toFixed(2)}
        />
        {isMultiple && showLegend && <Legend />}
        
        {isMultiple ? (
          // Множественные показатели
          (indicators as string[]).map((name, idx) => {
            return (
            <Bar 
              key={name}
              dataKey={name} 
              fill={COLORS[idx % COLORS.length]}
              radius={[8, 8, 0, 0]}
              stackId={stacked ? 'stack' : undefined}
            />
          )})
        ) : (
          // Один показатель с разными цветами для каждой категории
          <Bar dataKey={indicators as string} radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        )}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

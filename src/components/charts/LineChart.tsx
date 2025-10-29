'use client';

import { COLORS } from '@/lib/storage';
import { ChartDataPoint } from '@/types/dashboard';
import { 
  CartesianGrid, 
  Legend, 
  Line, 
  LineChart as RechartsLineChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from 'recharts';

interface LineChartProps {
  data: ChartDataPoint[];
  indicators: string[] | string;
  height?: number;
  showLegend?: boolean;
  smooth?: boolean;
}

export default function LineChart({ 
  data, 
  indicators, 
  height = 400,
  showLegend = true,
  smooth = true
}: LineChartProps) {
  const isMultiple = Array.isArray(indicators);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart 
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          formatter={(value: number) => value.toFixed(2)}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px'
          }}
        />
        {isMultiple && showLegend && <Legend />}
        
        {isMultiple ? (
          (indicators as string[]).map((name, idx) => (
            <Line
              key={name}
              type={smooth ? 'monotone' : 'linear'}
              dataKey={name}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))
        ) : (
          <Line
            type={smooth ? 'monotone' : 'linear'}
            dataKey={indicators as string}
            stroke={COLORS[0]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        )}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

'use client';

import { COLORS } from '@/lib/storage';
import { 
  Cell, 
  Legend, 
  Pie, 
  PieChart as RechartsPieChart, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';

interface PieChartProps {
  data: {
    name: string;
    value: number;
  }[];
  height?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  innerRadius?: number;
}

export default function PieChart({ 
  data, 
  height = 400,
  showLegend = true,
  showLabels = true,
  innerRadius = 50 // 0 = обычный круг, >0 = пончик
}: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={showLabels}
          label={showLabels ? (entry) => 
            `${entry.name}: ${(entry.value as number).toFixed(2)}`
          : false}
          outerRadius={140}
          innerRadius={innerRadius}
          fill="#8884d8"
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => value.toFixed(2)}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px'
          }}
        />
        {showLegend && <Legend />}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

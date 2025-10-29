'use client'

import { COLORS } from "@/lib/storage";
import { ChartDataPoint } from "@/types/dashboard";
import { isArray } from "mathjs";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";


interface LinechartProps {
    data: ChartDataPoint[]
    indicators: string[] | string
}



export default function Linechart({data, indicators} : LinechartProps) {

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              {isArray(indicators) && <Legend />}
              {isArray(indicators) && indicators.map((name, idx) => (
                <Line 
                  key={name} 
                  type="monotone" 
                  dataKey={name} 
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                />
              ))}

            {typeof indicators == 'string' && <Line type="monotone" dataKey="value" name={indicators} stroke='purple' />}
            </LineChart>
        </ResponsiveContainer>
    )
}
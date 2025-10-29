import { COLORS } from "@/lib/storage";
import { ChartDataPoint } from "@/types/dashboard";
import { isArray } from "mathjs";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface BarchartProps {
    data: ChartDataPoint[]
    indicators: string[] | string
}

export default function Barchart({data, indicators}: BarchartProps) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              {isArray(indicators) && <Legend />}
              {isArray(indicators) && indicators.map((name, idx) => (
                <Bar key={name} dataKey={name} fill={COLORS[idx % COLORS.length]}> </Bar>
              ))}

              {typeof indicators == 'string' && <Bar dataKey="value" name={indicators}>
                {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                </Bar>}
            </BarChart>
        </ResponsiveContainer>
    )
}
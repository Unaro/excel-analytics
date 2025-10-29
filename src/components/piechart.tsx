import { COLORS } from "@/lib/storage";
import { Cell, Legend, Pie, PieChart, PieLabelRenderProps, ResponsiveContainer, Tooltip } from "recharts";

interface PiechartProps {
    data: {
        name: string;
        value: number;
    }[]
}

export default function Piechart({data} : PiechartProps) {
    return (
        <ResponsiveContainer width="100%" height={350}>
            <PieChart>
            <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: PieLabelRenderProps) => typeof entry.value === 'number' ? `${entry.name} : ${entry.value.toFixed(0)}` : String(entry.value)}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
            >
                {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
            </Pie>
            <Tooltip 
                formatter={(value: number) => value.toFixed(1)}
            />
            <Legend />
            </PieChart>
    </ResponsiveContainer>
    )
}
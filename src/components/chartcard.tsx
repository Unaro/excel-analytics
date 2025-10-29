interface ChartCardProps {
    name: string
    value: string
    indicator: string
    color: string
}

export default function ChartCard({name, value, indicator, color}: ChartCardProps) {
    return (
        <div
            className="bg-white rounded-lg shadow-lg p-4 border-l-4 hover:shadow-xl transition-shadow"
            style={{color}}
        >
        <p className="text-sm text-gray-600 mb-1">{name}</p>
        <p className="text-3xl font-bold" style={{ color }}>
            {value}
        </p>
        <p className="text-xs text-gray-500 mt-1">{indicator}</p>
        </div>
    )
}
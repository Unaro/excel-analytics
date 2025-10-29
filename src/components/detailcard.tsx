import { COLORS } from "@/lib/storage";
import { DetailedHTMLProps, HTMLAttributes } from "react";

interface DetailedCardProps {
    data: {
        groupId: string;
        groupName: string;
        filters: {
            id: string;
            column: string;
            operator: string;
            value: string;
        }[];
        hierarchyFilters: Record<string, string> | undefined;
        deepestFilter: {
            column: string;
            value: string;
        } | null;
        indicators: {
            name: string;
            formula: string;
            value: number;
        }[];
        rowCount: number;
    }
    idx: number
}

export default function DetailedCard({data, idx, ...props}: DetailedCardProps & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
    return(
        <div {...props} className="bg-white rounded-lg shadow-lg p-6 print-break-inside-avoid">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
            />
            {data.groupName}
        </h3>

        {data.deepestFilter && (
            <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
            <p className="text-purple-900 font-semibold">
                🔍 {data.deepestFilter.column}: {data.deepestFilter.value}
            </p>
            </div>
        )}

        <div className="space-y-3">
            {data.indicators.map((indicator) => (
            <div key={indicator.name} className="border-l-4 pl-3" style={{ borderColor: COLORS[idx % COLORS.length] }}>
                <p className="text-sm text-gray-600">{indicator.name}</p>
                <p className="text-2xl font-bold text-gray-800">
                {indicator.value.toFixed(2)}
                </p>
            </div>
            ))}
            <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
                На основе {data.rowCount} записей
            </p>
            </div>
        </div>
        </div>
    )
}
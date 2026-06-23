import type { ReactElement } from 'react';
import { Radar } from 'recharts';
import { formatRu } from '@/shared/lib/utils/format';
import type { GroupedThreshold } from '@/shared/lib/utils/thresholds';

// ─────────────────────────────────────────────────────────────
// Polar-пороги для радарных чартов (Radar-полигон вместо линии).
//
// Раньше — две байт-идентичные копии: GroupRadarChart и
// charts-section/RadarChartView. Значение порога должно лежать в данных под
// ключом `__threshold_<gi>` (его кладёт построитель данных чарта).
//
// ВАЖНО: ФУНКЦИЯ, а не компонент — recharts распознаёт Radar только как
// прямого ребёнка чарта. Вызывать инлайн: `{renderThresholdRadars(groups)}`.
// Парная к renderThresholdReferenceLines (cartesian); общий стиль-субстрат,
// architecture/unified-view-config.md, Фаза 1.
// ─────────────────────────────────────────────────────────────

export function renderThresholdRadars(
  groups: GroupedThreshold[]
): ReactElement[] {
  return groups.map((group, gi) => (
    <Radar
      key={`threshold-${gi}`}
      name={`Порог: ${formatRu(group.y)}`}
      dataKey={`__threshold_${gi}`}
      stroke={group.primaryColor}
      strokeWidth={group.isOverlap ? 2.5 : 2}
      strokeDasharray={group.isOverlap ? '4 2 1 2' : '6 3'}
      fill={group.primaryColor}
      fillOpacity={0.04}
      isAnimationActive={false}
      legendType="none"
      dot={false}
      opacity={0.85}
    />
  ));
}

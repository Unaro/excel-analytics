import type { ReactElement } from 'react';
import { ReferenceLine, Label } from 'recharts';
import { ThresholdLabel } from './ThresholdLabel';
import type { GroupedThreshold } from '@/shared/lib/utils/thresholds';

// ─────────────────────────────────────────────────────────────
// Cartesian-пороговые линии для bar/line-чартов (ReferenceLine + подпись).
//
// Раньше — три байт-идентичные копии: GroupBarChart, charts-section/BarChartView
// и 2-D time-breakdown (LineChart). Радар рисует пороги иначе (Radar-полигоны),
// поэтому сюда не входит.
//
// ВАЖНО: это ФУНКЦИЯ, а не компонент. recharts распознаёт ReferenceLine, только
// если это прямой ребёнок чарта; обёртка-компонент сломала бы детекцию. Поэтому
// вызывать инлайн: `{renderThresholdReferenceLines(groups)}`. Возврат массива
// элементов эквивалентен прежнему inline-`groups.map(...)`.
// Часть общего стиль-субстрата (architecture/unified-view-config.md, Фаза 1).
// ─────────────────────────────────────────────────────────────

export function renderThresholdReferenceLines(
  groups: GroupedThreshold[]
): ReactElement[] {
  return groups.map((group, gi) => (
    <ReferenceLine
      key={`threshold-${gi}`}
      y={group.y}
      stroke={group.primaryColor}
      strokeDasharray={group.isOverlap ? '4 2 1 2' : '6 3'}
      strokeWidth={group.isOverlap ? 2 : 1.5}
      opacity={0.7}
      ifOverflow="extendDomain"
    >
      <Label
        content={(props) => (
          <ThresholdLabel
            viewBox={props.viewBox as { x: number; y: number; width: number; height: number }}
            value={group.labelValue}
            group={group}
          />
        )}
      />
    </ReferenceLine>
  ));
}

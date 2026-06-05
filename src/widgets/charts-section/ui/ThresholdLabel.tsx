'use client';
import { useRef, useState, useCallback } from 'react';
import type { GroupedThreshold } from '@/shared/lib/utils/thresholds';
import { useHoverPopup } from '../model/useHoverPopup';
import { ThresholdPopup, ThresholdRuleEntry } from './ThresholdPopup';

interface ThresholdLabelProps {
  viewBox?: { x: number; y: number; width: number; height: number };
  value: number;
  group: GroupedThreshold;
}

export function ThresholdLabel({ viewBox, value, group }: ThresholdLabelProps) {
  const { isOpen, show, hide } = useHoverPopup();
  const markerRef = useRef<SVGGElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleEnter = useCallback(() => {
    if (markerRef.current) {
      const rect = markerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setAnchorRect(rect);
    }
    show();
  }, [show]);

  const handleLeave = useCallback(() => {
    hide();
  }, [hide]);

  if (!viewBox) return null;

  const x = viewBox.x + viewBox.width - 8;
  const y = viewBox.y;
  const formattedValue = value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

  return (
    <>
      <g
        ref={markerRef}
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        pointerEvents="all"
        cursor="pointer"
      >
        <rect x={x - 40} y={y - 15} width={60} height={30} fill="transparent" pointerEvents="all" />
        <g transform={`translate(${x}, ${y})`}>
          <circle
            cx={-4} cy={-4}
            r={group.isOverlap ? 5 : 3.5}
            fill={group.primaryColor}
            stroke="#fff"
            strokeWidth={1.5}
            pointerEvents="none"
          />
          <text
            x={-12} y={0}
            textAnchor="end"
            fontSize={9}
            fontWeight={600}
            fill={group.primaryColor}
            style={{ fontFamily: 'ui-monospace, monospace' }}
            pointerEvents="none"
          >
            {formattedValue}
          </text>
          {group.isOverlap && (
            <>
              <rect x={2} y={-11} width={18} height={14} rx={7} fill={group.primaryColor} pointerEvents="none" />
              <text
                x={11} y={-1}
                textAnchor="middle"
                fontSize={8}
                fontWeight={700}
                fill="#fff"
                pointerEvents="none"
              >
                +{group.rules.length - 1}
              </text>
            </>
          )}
        </g>
      </g>
      <ThresholdPopup
        anchorRect={anchorRect}
        thresholdValue={value}
        rules={group.rules as ThresholdRuleEntry[]}
        open={isOpen}
        placement="left"
        onMouseEnter={show}
        onMouseLeave={hide}
      />
    </>
  );
}
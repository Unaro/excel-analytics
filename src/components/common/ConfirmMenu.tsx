// src/components/common/ConfirmMenu.tsx
import { useState } from 'react';

export function ConfirmMenu({
  actions,
  onClose,
}: {
  actions: Array<{ label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }>;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => {
              a.onClick();
              onClose();
            }}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center ${
              a.danger ? 'text-red-600 hover:bg-red-50' : ''
            }`}
          >
            {a.icon}
            <span className={a.icon ? 'ml-2' : ''}>{a.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

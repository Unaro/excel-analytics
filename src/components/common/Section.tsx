// src/components/common/Section.tsx
export function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="border-t pt-6">
      {title && (
        <div className="flex items-center mb-4">
          {Icon && <Icon className="w-5 h-5 text-blue-500 mr-2" />}
          <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      )}
      {children}
    </div>
  );
}

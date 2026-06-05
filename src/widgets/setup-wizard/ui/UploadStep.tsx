'use client';
import { FileUploader } from '@/features/UploadExcel';
import { PostgresConnectionForm } from '@/features/PostgresConnection';
import { PostgresTableBrowser } from '@/features/PostgresTableBrowser';
import { SourceTypeSelector } from './SourceTypeSelector';
import type { SourceType, PgStep } from '@/features/setup-wizard';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';

interface UploadStepProps {
  sourceType: SourceType;
  pgStep: PgStep;
  pgConfig: PgConnectionConfig | null;
  onSourceTypeChange: (type: SourceType) => void;
  onFileSuccess: () => void;
  onPgConnected: (config: PgConnectionConfig) => void;
  onPgSyncComplete: () => void;
}

export function UploadStep({
  sourceType,
  pgStep,
  pgConfig,
  onSourceTypeChange,
  onFileSuccess,
  onPgConnected,
  onPgSyncComplete,
}: UploadStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SourceTypeSelector value={sourceType} onChange={onSourceTypeChange} />

      {sourceType === 'file' ? (
        <FileUploader onSuccess={onFileSuccess} />
      ) : pgStep === 'connection' ? (
        <PostgresConnectionForm onConnected={onPgConnected} />
      ) : (
        <PostgresTableBrowser config={pgConfig} onComplete={onPgSyncComplete} />
      )}
    </div>
  );
}
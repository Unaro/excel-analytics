'use client';

import { FileUploader } from '@/widgets/file-uploader';
import { PgStep, SourceType } from '../model/types';
import { SourceTypeSelector } from './SourceTypeSelector';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import { PostgresConnectionForm } from '@/widgets/postgres-connection-form';
import { PostgresTableBrowser } from '@/widgets/postgres-table-browser';

interface UploadStepProps {
  sourceType: SourceType;
  pgStep: PgStep;
  pgConfig: PgConnectionConfig | null;
  onSourceTypeChange: (type: SourceType) => void;
  onFileSelected: (file: File) => void;
  onPgConnected: (config: PgConnectionConfig) => void;
  onPgSyncComplete: () => void;
}

export function UploadStep({
  sourceType, pgStep, pgConfig,
  onSourceTypeChange, onFileSelected, onPgConnected, onPgSyncComplete,
}: UploadStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SourceTypeSelector value={sourceType} onChange={onSourceTypeChange} />
      {sourceType === 'file' ? (
        <FileUploader onFileSelected={onFileSelected} />
      ) : pgStep === 'connection' ? (
        <PostgresConnectionForm onConnected={onPgConnected} />
      ) : (
        <PostgresTableBrowser config={pgConfig} onComplete={onPgSyncComplete} />
      )}
    </div>
  );
}
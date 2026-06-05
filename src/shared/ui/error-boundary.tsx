'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RotateCw, Bug } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary] ${this.props.label || 'Unknown widget'} crashed:`,
      error,
      errorInfo.componentStack
    );
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-xl border-2 border-dashed border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10 p-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-rose-900 dark:text-rose-200 mb-1">
                Ошибка в виджете {this.props.label && `«${this.props.label}»`}
              </h3>
              <p className="text-sm text-rose-700/80 dark:text-rose-300/70 mb-3 break-words">
                {this.state.error?.message || 'Неизвестная ошибка'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleReset}
                  className="gap-1.5"
                >
                  <RotateCw size={14} />
                  Повторить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Копируем stacktrace для отладки
                    const debug = `${this.props.label}\n${this.state.error?.stack}`;
                    navigator.clipboard?.writeText(debug);
                  }}
                  className="gap-1.5 text-rose-600 hover:text-rose-700"
                >
                  <Bug size={14} />
                  Скопировать stacktrace
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
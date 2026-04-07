'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">
            حدث خطأ أثناء العرض
          </h3>
          <p className="text-sm text-muted-foreground mb-2 max-w-md">
            يرجى المحاولة مرة أخرى أو الانتقال إلى صفحة أخرى
          </p>
          <p className="text-xs text-destructive bg-destructive/10 rounded-md p-3 mb-4 max-w-lg font-mono" dir="ltr">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RotateCcw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

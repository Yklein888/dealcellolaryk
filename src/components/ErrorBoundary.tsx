import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for development
    console.error('Error Boundary caught an error:', error, errorInfo);

    // You could also log to an error reporting service here
    // e.g., logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: this.state.errorCount + 1,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="max-w-md w-full mx-auto p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              משהו השתבש
            </h1>

            <p className="text-muted-foreground text-center mb-4">
              אנחנו סוררים על כך. אנא נסה לרענן את הדף או חזור מאוחר יותר.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs font-mono text-destructive/80 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={this.handleReset}
                variant="glow"
                className="flex-1 gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                נסה שוב
              </Button>

              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="flex-1"
              >
                חזור לבית
              </Button>
            </div>

            {this.state.errorCount > 2 && (
              <p className="mt-4 text-xs text-muted-foreground text-center">
                אם הבעיה נמשכת, אנא צור קשר עם התמיכה
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

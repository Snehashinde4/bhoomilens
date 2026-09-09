import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './EmptyState';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Replace with the observability sink (Sentry/OpenTelemetry) in production.
    console.error('[BhoomiLens] render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="surface-card m-4">
          <ErrorState
            title={this.props.fallbackTitle ?? 'This module could not be displayed'}
            description={this.state.error.message}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

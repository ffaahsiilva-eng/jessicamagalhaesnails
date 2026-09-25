import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // A cached page can briefly request an old lazy-loaded file after an update.
    // Reload once so the browser receives the matching current application files.
    const isStaleFileError = /dynamically imported module|loading chunk|chunkloaderror|failed to fetch/i.test(
      error.message,
    );
    if (isStaleFileError && sessionStorage.getItem("stale-file-reload") !== "1") {
      sessionStorage.setItem("stale-file-reload", "1");
      window.location.reload();
      return;
    }
    
    // Log to performance monitoring
    if (typeof window !== "undefined" && "performance" in window) {
      performance.mark("error-boundary-catch");
    }
  }

  handleRetry = () => {
    sessionStorage.removeItem("stale-file-reload");
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Algo deu errado
            </h3>
            <p className="text-muted-foreground font-body text-sm mb-6">
              Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato conosco.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={this.handleRetry}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
              <Button
                onClick={this.handleReload}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

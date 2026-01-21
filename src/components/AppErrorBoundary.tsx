import React from "react";

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string; stack?: string }
> {
  state = { 
    hasError: false, 
    message: undefined as string | undefined,
    stack: undefined as string | undefined
  };

  static getDerivedStateFromError(err: any) {
    return { 
      hasError: true, 
      message: err?.message || "Unknown error",
      stack: err?.stack
    };
  }

  componentDidCatch(err: any, errorInfo: any) {
    console.error("[UI] Uncaught error:", err);
    console.error("[UI] Component stack:", errorInfo.componentStack);
    
    // Log to monitoring service if available
    if (window.location.hostname === 'localhost') {
      console.error("[UI] Full error details:", { err, errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0f0f0f] border border-red-500/30 rounded-xl p-5">
            <div className="text-white font-semibold text-lg mb-2">
              Something broke
            </div>
            <div className="text-gray-400 text-sm mb-4">
              Try refreshing. If it keeps happening, we'll fix it fast.
            </div>
            {this.state.message && (
              <div className="text-xs text-gray-500 break-words mb-3 font-mono bg-black/30 p-3 rounded">
                {this.state.message}
              </div>
            )}
            {window.location.hostname === 'localhost' && this.state.stack && (
              <details className="text-xs text-gray-600 mb-3">
                <summary className="cursor-pointer hover:text-gray-400">
                  Stack trace (dev only)
                </summary>
                <pre className="mt-2 bg-black/30 p-2 rounded overflow-auto max-h-40">
                  {this.state.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

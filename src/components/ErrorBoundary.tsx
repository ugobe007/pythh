import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const isSupabaseError = error?.message?.includes('Supabase') || 
                              error?.message?.includes('Missing') ||
                              error?.stack?.includes('supabase');
      const isOpenAIError = error?.message?.includes('OpenAI') || 
                           error?.message?.includes('apiKey');

      return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Application Error</h1>
                <p className="text-slate-400">Something went wrong</p>
              </div>
            </div>

            {(isSupabaseError || isOpenAIError) && (
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <h3 className="text-yellow-400 font-semibold mb-2">⚠️ Missing Environment Variables</h3>
                <p className="text-slate-300 text-sm mb-3">
                  {isSupabaseError && (
                    <>
                      <strong>Supabase credentials are missing.</strong> Please add to your <code className="bg-slate-800 px-2 py-1 rounded">.env</code> file:
                    </>
                  )}
                  {isOpenAIError && (
                    <>
                      <strong>OpenAI API key is missing.</strong> This is optional but some features may not work.
                    </>
                  )}
                </p>
                {isSupabaseError && (
                  <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
                    <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
                    <div>VITE_SUPABASE_ANON_KEY=your-anon-key-here</div>
                  </div>
                )}
                {isOpenAIError && (
                  <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300">
                    VITE_OPENAI_API_KEY=your-api-key-here
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-2">Error Details:</h3>
              <pre className="text-red-400 text-xs overflow-auto max-h-40">
                {error?.message || 'Unknown error'}
              </pre>
            </div>

            {this.state.errorInfo && (
              <details className="mb-6">
                <summary className="text-slate-400 cursor-pointer hover:text-white text-sm mb-2">
                  Stack Trace
                </summary>
                <pre className="text-slate-500 text-xs overflow-auto max-h-40 bg-slate-900 rounded p-3">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold rounded-lg transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              <a
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
              >
                <Home className="w-4 h-4" />
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


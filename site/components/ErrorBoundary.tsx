import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err?.message || "Something went wrong." };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center"
          style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.85 0.01 264)" }}>
          <p className="text-sm opacity-80">The app hit an error.</p>
          <p className="text-xs font-mono max-w-md opacity-60">{this.state.message}</p>
          <button
            type="button"
            className="mt-2 text-sm underline text-emerald-400"
            onClick={() => this.setState({ hasError: false, message: "" })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

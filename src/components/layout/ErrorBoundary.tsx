"use client";
import React from "react";
import EmptyState from "@/components/ui/EmptyState";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("Dashline UI boundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="py-10">
          <EmptyState
            title="Something went wrong"
            subtitle="We could not render this section. Try again or refresh the page."
            primaryAction={{ label: "Try again", onClick: this.handleReset }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

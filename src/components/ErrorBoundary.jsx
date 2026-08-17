import React from "react";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty.jsx";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="shell">
        <Empty className="min-h-72 bg-card shadow-sm">
          <EmptyTitle>Interface error</EmptyTitle>
          <EmptyDescription>{this.state.error.message || "The interface could not render."}</EmptyDescription>
        </Empty>
      </main>
    );
  }
}

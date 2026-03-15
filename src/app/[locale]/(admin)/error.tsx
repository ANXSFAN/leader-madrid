"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        An unexpected error occurred in the admin panel. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}

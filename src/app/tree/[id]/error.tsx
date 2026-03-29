"use client";

export default function TreeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold">Error loading tree</h2>
        <p className="text-muted-foreground">
          {error.message || "Failed to load the family tree. Please try again."}
        </p>
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

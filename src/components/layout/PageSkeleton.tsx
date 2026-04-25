export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 bg-border/70" />
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-4 w-1/2 rounded-lg bg-muted shimmer-block" />
          <div className="h-4 w-3/4 rounded-lg bg-muted shimmer-block" />
          <div className="h-4 w-1/3 rounded-lg bg-muted shimmer-block" />
          <p className="pt-2 text-center text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  message?: string;
}
export function EmptyChart({ message = "Sem dados no período selecionado." }: Props) {
  return (
    <div className="h-72 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
      {message}
    </div>
  );
}

interface InfoPanelProps {
  title: string;
  items: Array<[string, string]>;
}

export default function InfoPanel({ title, items }: InfoPanelProps) {
  return (
    <div className="rounded-lg border border-muted/60 bg-card p-4">
      <p className="mb-3 text-sm font-semibold text-primary">{title}</p>
      <dl className="space-y-2 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="text-secondary">{label}</dt>
            <dd className="font-medium text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

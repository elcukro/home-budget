interface SummaryCardProps {
  title: string;
  value: string;
  tone?: 'positive' | 'neutral' | 'warning';
}

const toneClassMap: Record<Required<SummaryCardProps>['tone'], string> = {
  positive: 'bg-success/15 text-success',
  neutral: 'bg-muted',
  warning: 'bg-warning/15 text-warning-foreground',
};

export default function SummaryCard({
  title,
  value,
  tone = 'neutral',
}: SummaryCardProps) {
  return (
    <div className={`rounded-lg border border-muted/60 p-4 ${toneClassMap[tone]}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "success" | "warning";
};

export function StatusBadge({
  label,
  tone = "neutral"
}: StatusBadgeProps) {
  return <span className={`statusBadge ${tone}`}>{label}</span>;
}

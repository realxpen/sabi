export function normalizeRelativeDeadline(
  deadline: string | undefined,
  createdAt: string
): string | undefined {
  if (!deadline) return deadline;

  const normalized = deadline.trim().toLowerCase();
  if (normalized !== "today" && normalized !== "tomorrow") {
    return deadline;
  }

  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) return deadline;

  if (normalized === "tomorrow") {
    base.setUTCDate(base.getUTCDate() + 1);
  }

  return base.toISOString().slice(0, 10);
}

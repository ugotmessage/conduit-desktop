import { t as __tr } from "../../lib/i18n";
export function formatRelativeTime(dateString: string, now: number = Date.now()): string {
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return __tr("Just now");
  if (diffMins < 60) return __tr("{v0}m ago", { v0: (diffMins) });
  if (diffHours < 24) return __tr("{v0}h ago", { v0: (diffHours) });
  if (diffDays === 1) return __tr("Yesterday");
  if (diffDays < 7) return __tr("{v0}d ago", { v0: (diffDays) });
  if (diffDays < 30) return __tr("{v0}w ago", { v0: (Math.floor(diffDays / 7)) });
  return new Date(dateString).toLocaleDateString();
}

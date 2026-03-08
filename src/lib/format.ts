import type { ScheduleType, ScheduleConfig } from "@openorchestra/shared";

/** Format a schedule into human-readable text */
export function formatSchedule(
  type: ScheduleType,
  config: ScheduleConfig,
): string {
  switch (type) {
    case "once":
      return "Runs once immediately";
    case "interval": {
      const c = config as { minutes: number };
      if (c.minutes < 60) return `Every ${c.minutes} minutes`;
      if (c.minutes === 60) return "Every hour";
      if (c.minutes % 60 === 0) return `Every ${c.minutes / 60} hours`;
      const h = Math.floor(c.minutes / 60);
      const m = c.minutes % 60;
      return `Every ${h}h ${m}m`;
    }
    case "cron": {
      const c = config as { expression: string };
      return describeCron(c.expression);
    }
    default:
      return String(type);
  }
}

function describeCron(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length < 5) return `Cron: ${expr}`;

  const [min, hour, dom, , dow] = parts;

  if (dom === "*" && dow === "*") {
    if (hour === "*" && min === "*") return "Every minute";
    if (hour === "*") return `Every hour at :${min.padStart(2, "0")}`;
    return `Daily at ${hour}:${min.padStart(2, "0")}`;
  }

  if (dow !== "*" && dom === "*") {
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      Number(dow)
    ];
    return `Every ${dayName || dow} at ${hour}:${min.padStart(2, "0")}`;
  }

  return `Cron: ${expr}`;
}

/** Format a relative time string from an ISO date */
export function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const absDiff = Math.abs(diff);
  const future = diff < 0;
  const prefix = future ? "in " : "";
  const suffix = future ? "" : " ago";

  if (absDiff < 60_000) return "just now";
  if (absDiff < 3_600_000) {
    const m = Math.floor(absDiff / 60_000);
    return `${prefix}${m}m${suffix}`;
  }
  if (absDiff < 86_400_000) {
    const h = Math.floor(absDiff / 3_600_000);
    return `${prefix}${h}h${suffix}`;
  }
  const d = Math.floor(absDiff / 86_400_000);
  return `${prefix}${d}d${suffix}`;
}

/** Format a duration in milliseconds */
export function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/** Get elapsed duration between two ISO dates, or from start to now */
export function getElapsed(
  startedAt: string | null,
  finishedAt: string | null,
): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  return end - start;
}

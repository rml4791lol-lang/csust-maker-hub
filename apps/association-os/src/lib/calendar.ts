/** Calendar dates are civil dates in Shanghai, never inferred from yearless records. */
export function activityDay(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|[ T]\d{2}:\d{2}(?::\d{2})?$)/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) return null;
  const time = value.trim().slice(11);
  if (time && (Number(time.slice(0, 2)) > 23 || Number(time.slice(3, 5)) > 59 || Number(time.slice(6, 8) || 0) > 59)) return null;
  return match[1];
}

export function shanghaiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function shiftDay(day: string, amount: number): string {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function weekDays(day: string): string[] {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const monday = shiftDay(day, weekday === 0 ? -6 : 1 - weekday);
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}

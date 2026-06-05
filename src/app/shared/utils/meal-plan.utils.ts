const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateInput(date: string | Date): Date {
  if (typeof date === 'string') {
    return new Date(`${date}T00:00:00`);
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: string | Date, days: number): string {
  const parsed = parseDateInput(date);
  parsed.setDate(parsed.getDate() + days);
  return toISODate(parsed);
}

export function getMondayOfWeek(date: string | Date = new Date()): string {
  const parsed = parseDateInput(date);
  const day = parsed.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  parsed.setDate(parsed.getDate() + diff);
  return toISODate(parsed);
}

export function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  for (let index = 0; index < 7; index++) {
    dates.push(addDays(startDate, index));
  }
  return dates;
}

export function formatWeekRange(dates: string[]): string {
  if (dates.length === 0) {
    return '';
  }

  const start = parseDateInput(dates[0]);
  const end = parseDateInput(dates[dates.length - 1]);
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startLabel} – ${endLabel}`;
}

export function formatDayLabel(date: string): string {
  return parseDateInput(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function isToday(date: string): boolean {
  return date === toISODate(new Date());
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = parseDateInput(startDate).getTime();
  const end = parseDateInput(endDate).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

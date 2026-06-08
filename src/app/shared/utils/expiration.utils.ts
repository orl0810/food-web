const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(date: string | null | undefined): Date | null {
  if (!date) {
    return null;
  }
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(date: Date, today: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / MS_PER_DAY);
}

export function getDaysUntilExpiration(
  date: string | null | undefined,
  today: Date = new Date()
): number | null {
  const parsed = parseDate(date);
  if (!parsed) {
    return null;
  }
  return daysUntil(parsed, today);
}

export function isExpired(
  date: string | null | undefined,
  today: Date = new Date()
): boolean {
  const parsed = parseDate(date);
  if (!parsed) {
    return false;
  }
  return daysUntil(parsed, today) < 0;
}

export function isExpiringSoon(
  date: string | null | undefined,
  days = 3,
  today: Date = new Date()
): boolean {
  const parsed = parseDate(date);
  if (!parsed) {
    return false;
  }
  const remaining = daysUntil(parsed, today);
  return remaining >= 0 && remaining <= days;
}

export function getExpirationLabel(
  date: string | null | undefined,
  today: Date = new Date()
): string {
  const parsed = parseDate(date);
  if (!parsed) {
    return 'No date';
  }

  const remaining = daysUntil(parsed, today);

  if (remaining < 0) {
    return remaining === -1 ? 'Expired yesterday' : `Expired ${Math.abs(remaining)} days ago`;
  }
  if (remaining === 0) {
    return 'Expires today';
  }
  if (remaining === 1) {
    return 'Expires tomorrow';
  }
  return `In ${remaining} days`;
}

export type ExpirationUrgency = 'today' | 'tomorrow' | 'soon' | 'later';

export function getExpirationUrgency(
  date: string | null | undefined,
  today: Date = new Date()
): ExpirationUrgency {
  const parsed = parseDate(date);
  if (!parsed) {
    return 'later';
  }

  const remaining = daysUntil(parsed, today);
  if (remaining === 0) {
    return 'today';
  }
  if (remaining === 1) {
    return 'tomorrow';
  }
  if (remaining <= 3) {
    return 'soon';
  }
  return 'later';
}

export function getExpirationShortLabel(
  date: string | null | undefined,
  today: Date = new Date()
): string {
  const parsed = parseDate(date);
  if (!parsed) {
    return '—';
  }

  const remaining = daysUntil(parsed, today);
  if (remaining === 0) {
    return 'Today';
  }
  if (remaining === 1) {
    return 'Tomorrow';
  }

  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getUseFirstActionLabel(
  date: string | null | undefined,
  today: Date = new Date()
): string {
  const parsed = parseDate(date);
  if (!parsed) {
    return '';
  }

  const remaining = daysUntil(parsed, today);
  if (remaining === 0) {
    return 'Use today';
  }
  if (remaining === 1) {
    return 'Use in 1 day';
  }
  if (remaining === 2) {
    return 'Use in 2 days';
  }
  if (remaining <= 3) {
    return 'Expiring soon';
  }
  return `In ${remaining} days`;
}

export type ExpirationStatus = 'none' | 'ok' | 'soon' | 'expired';

export function getExpirationStatus(
  date: string | null | undefined,
  today: Date = new Date()
): ExpirationStatus {
  if (!date) {
    return 'none';
  }
  if (isExpired(date, today)) {
    return 'expired';
  }
  if (isExpiringSoon(date, 3, today)) {
    return 'soon';
  }
  return 'ok';
}

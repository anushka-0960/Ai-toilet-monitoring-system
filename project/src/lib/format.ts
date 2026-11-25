import type { SensorReading, UrgencyScore } from './supabase';

export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--color-score-unknown, #64748b)';
  if (score < 4) return '#16a34a';
  if (score <= 7) return '#d97706';
  return '#dc2626';
}

export function scoreLabel(score: number | null): string {
  if (score === null) return 'No data yet';
  if (score < 4) return 'Clean';
  if (score <= 7) return 'Getting dirty';
  return 'Cleaning required';
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never recorded';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

export function readingIsStale(reading: SensorReading | null): boolean {
  if (!reading) return true;
  return Date.now() - new Date(reading.recorded_at).getTime() > 10 * 60 * 1000;
}

export function chartTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

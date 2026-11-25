import { Sparkles } from 'lucide-react';
import type { SensorReading, Toilet, UrgencyScore } from '@/lib/supabase';
import { formatRelativeTime, scoreColor, scoreLabel } from '@/lib/format';

interface StatusPanelProps {
  toilet: Toilet | null;
  reading: SensorReading | null;
  score: UrgencyScore | null;
  stale: boolean;
  markingCleaned: boolean;
  onMarkAsCleaned: () => void;
}

export function StatusPanel({
  toilet,
  reading,
  score,
  stale,
  markingCleaned,
  onMarkAsCleaned,
}: StatusPanelProps) {
  const scoreValue = score ? score.score : null;
  const needsCleaning = scoreValue !== null && scoreValue > 7;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {needsCleaning && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-4">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <div>
            <p className="text-sm font-bold text-red-800">CLEANING REQUIRED</p>
            <p className="text-xs text-red-600">Alert sent to cleaner — schedule a visit now</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border-4"
            style={{ borderColor: scoreColor(scoreValue), backgroundColor: `${scoreColor(scoreValue)}14` }}
          >
            <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(scoreValue) }}>
              {scoreValue !== null ? scoreValue.toFixed(1) : '—'}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">urgency</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{toilet?.name ?? 'Loading…'}</h2>
              {toilet?.location && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {toilet.location}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium" style={{ color: scoreColor(scoreValue) }}>
              {scoreLabel(scoreValue)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Scored by {score?.method === 'ml' ? 'ML model' : score?.method === 'rule' ? 'rule-based engine' : '—'} ·{' '}
              {score ? formatRelativeTime(score.created_at) : 'no scores yet'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Last cleaned</p>
            <p className="text-sm font-semibold text-slate-700">
              {formatRelativeTime(toilet?.last_cleaned_at ?? null)}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Last reading</p>
            <p className={`text-sm font-semibold ${stale ? 'text-amber-600' : 'text-slate-700'}`}>
              {reading ? formatRelativeTime(reading.recorded_at) : 'no data yet'}
              {stale && reading ? ' · device may be offline' : ''}
            </p>
          </div>
          <button
            onClick={onMarkAsCleaned}
            disabled={markingCleaned}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {markingCleaned ? 'Saving…' : 'Mark as Cleaned'}
          </button>
        </div>
      </div>
    </div>
  );
}

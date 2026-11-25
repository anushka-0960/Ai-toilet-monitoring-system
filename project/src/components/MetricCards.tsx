import { Droplets, Gauge, Info, Timer, Wind } from 'lucide-react';
import type { SensorReading } from '@/lib/supabase';

interface MetricCardsProps {
  reading: SensorReading | null;
  stale: boolean;
}

export function MetricCards({ reading, stale }: MetricCardsProps) {
  const cards = [
    {
      icon: Wind,
      label: 'Ammonia',
      value: reading ? reading.ammonia_ppm.toFixed(1) : '—',
      unit: 'ppm',
      warning: reading ? reading.ammonia_ppm > 70 : false,
      detail: reading ? (reading.ammonia_ppm > 70 ? 'High — ventilate' : 'Within normal range') : 'Waiting for data',
    },
    {
      icon: Timer,
      label: 'Usage Count',
      value: reading ? String(reading.usage_count) : '—',
      unit: 'uses',
      warning: reading ? reading.usage_count > 20 : false,
      detail: reading ? (reading.usage_count > 20 ? 'Heavy traffic' : 'Since last clean') : 'Waiting for data',
    },
    {
      icon: Droplets,
      label: 'Water Level',
      value: reading ? reading.water_level : '—',
      unit: '',
      warning: reading ? reading.water_level === 'LOW' : false,
      detail: reading ? (reading.water_level === 'LOW' ? 'Refill needed' : 'Supply normal') : 'Waiting for data',
    },
    {
      icon: Gauge,
      label: 'Bin Fill',
      value: reading ? Math.round(reading.bin_fill_percent).toString() : '—',
      unit: '%',
      warning: reading ? reading.bin_fill_percent > 80 : false,
      detail: reading ? (reading.bin_fill_percent > 80 ? 'Empty soon' : 'Plenty of room') : 'Waiting for data',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, unit, warning, detail }) => (
        <div
          key={label}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
            <Icon className={`h-4 w-4 ${warning ? 'text-amber-600' : 'text-teal-700'}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{value}</span>
            {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {stale ? (
              <>
                <Info className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="text-xs text-slate-400">Device offline — last known value</span>
              </>
            ) : (
              <>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${warning ? 'bg-amber-500' : 'bg-teal-500'}`}
                />
                <span className={`text-xs ${warning ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
                  {detail}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SensorReading } from '@/lib/supabase';
import { chartTime } from '@/lib/format';

interface AmmoniaChartProps {
  history: SensorReading[];
}

export function AmmoniaChart({ history }: AmmoniaChartProps) {
  const data = history.map((r) => ({
    time: chartTime(r.recorded_at),
    ammonia: Number(r.ammonia_ppm.toFixed(1)),
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Ammonia — last 24 hours</h3>
          <p className="text-xs text-slate-500">
            {data.length > 0 ? `${data.length} readings` : 'No readings in this period yet'}
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">ppm</span>
      </div>
      <div className="h-72">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: 12,
                }}
                formatter={(value) => [`${value} ppm`, 'Ammonia']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ammonia" name="Ammonia (ppm)" stroke="#0d9488" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
            Waiting for the device to report its first readings…
          </div>
        )}
      </div>
    </div>
  );
}

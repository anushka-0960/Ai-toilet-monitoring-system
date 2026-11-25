import { useCallback, useState } from 'react';
import { Activity, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { AmmoniaChart } from '@/components/AmmoniaChart';
import { MetricCards } from '@/components/MetricCards';
import { StatusPanel } from '@/components/StatusPanel';
import { useToiletData } from '@/lib/useToiletData';
import { readingIsStale } from '@/lib/format';

const TOILET_ID = 'toilet_01';

function App() {
  const { toilet, latestReading, latestScore, history, loading, error, markAsCleaned } =
    useToiletData(TOILET_ID);
  const [markingCleaned, setMarkingCleaned] = useState(false);

  const handleMarkAsCleaned = useCallback(async () => {
    setMarkingCleaned(true);
    try {
      await markAsCleaned();
    } catch (err) {
      console.error('Failed to mark as cleaned:', err);
      alert('Could not save. Check your connection and try again.');
    } finally {
      setMarkingCleaned(false);
    }
  }, [markAsCleaned]);

  const stale = readingIsStale(latestReading);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-teal-900/20 bg-teal-800 shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-2xl">🚻</div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">AI Toilet Monitor</h1>
              <p className="text-xs text-teal-100/80">Real-time cleanliness &amp; maintenance alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-teal-50">
            {error ? (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                Connection issue
              </>
            ) : loading ? (
              <>
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                Connecting…
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5" />
                Live
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <p className="font-semibold">Could not reach the database</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-xs text-red-600/80">
              Check that the Supabase URL and anon key are set in the .env file and try again.
            </p>
          </div>
        ) : loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            Loading live data…
          </div>
        ) : (
          <>
            <StatusPanel
              toilet={toilet}
              reading={latestReading}
              score={latestScore}
              stale={stale}
              markingCleaned={markingCleaned}
              onMarkAsCleaned={handleMarkAsCleaned}
            />
            <MetricCards reading={latestReading} stale={stale} />
            <AmmoniaChart history={history} />
          </>
        )}

        <footer className="flex items-center justify-center gap-1.5 pt-2 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          AI Smart Public Toilet Monitoring System · data refreshed in real time
        </footer>
      </main>
    </div>
  );
}

export default App;

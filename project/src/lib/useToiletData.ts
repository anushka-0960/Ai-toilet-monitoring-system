import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase, type SensorReading, type Toilet, type UrgencyScore } from './supabase';

export function useToiletData(toiletId: string) {
  const [toilet, setToilet] = useState<Toilet | null>(null);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [latestScore, setLatestScore] = useState<UrgencyScore | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    const [toiletRes, readingRes, scoreRes, historyRes] = await Promise.all([
      supabase.from('toilets').select('*').eq('id', toiletId).maybeSingle(),
      supabase
        .from('sensor_readings')
        .select('*')
        .eq('toilet_id', toiletId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('urgency_scores')
        .select('*')
        .eq('toilet_id', toiletId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sensor_readings')
        .select('*')
        .eq('toilet_id', toiletId)
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: true }),
    ]);

    if (toiletRes.error) throw toiletRes.error;
    if (readingRes.error) throw readingRes.error;
    if (scoreRes.error) throw scoreRes.error;
    if (historyRes.error) throw historyRes.error;

    setToilet(toiletRes.data);
    setLatestReading(readingRes.data);
    setLatestScore(scoreRes.data);
    setHistory(historyRes.data ?? []);
  }

  async function markAsCleaned() {
    const { error: updateError } = await supabase
      .from('toilets')
      .update({ last_cleaned_at: new Date().toISOString() })
      .eq('id', toiletId);
    if (updateError) throw updateError;
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await fetchAll();
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const channels = [
      supabase
        .channel(`toilet-${toiletId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sensor_readings', filter: `toilet_id=eq.${toiletId}` },
          () => {
            fetchAll().catch(console.error);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'urgency_scores', filter: `toilet_id=eq.${toiletId}` },
          () => {
            fetchAll().catch(console.error);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'toilets', filter: `id=eq.${toiletId}` },
          (payload: RealtimePostgresChangesPayload<Toilet>) => {
            if (payload.eventType === 'UPDATE' && payload.new) {
              setToilet(payload.new as Toilet);
            } else {
              fetchAll().catch(console.error);
            }
          }
        )
        .subscribe(),
    ];

    return () => {
      cancelled = true;
      channels.forEach((ch) => {
        supabase.removeChannel(ch);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toiletId]);

  return { toilet, latestReading, latestScore, history, loading, error, markAsCleaned };
}

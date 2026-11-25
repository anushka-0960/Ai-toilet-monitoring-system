import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Toilet = {
  id: string;
  name: string;
  location: string | null;
  last_cleaned_at: string | null;
  last_alert_sent_at: string | null;
  created_at: string;
};

export type SensorReading = {
  id: string;
  toilet_id: string;
  ammonia_ppm: number;
  usage_count: number;
  water_level: 'OK' | 'LOW';
  bin_fill_percent: number;
  recorded_at: string;
  created_at: string;
};

export type UrgencyScore = {
  id: string;
  toilet_id: string;
  score: number;
  method: 'rule' | 'ml';
  created_at: string;
};

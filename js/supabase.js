import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// The URL and Key provided by the user
const SUPABASE_URL = 'https://auwnsxmdksplftccysqu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

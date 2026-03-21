const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://auwnsxmdksplftccysqu.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };

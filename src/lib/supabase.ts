import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://soguqzhuqfuuzvxfvpjc.supabase.co';
const supabaseAnonKey = 'sb_publishable_zN-nColUSS1rfJy4Gjscfw_08J9SoWN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://supabase.com and create a new project
 * 2. Navigate to Settings > API
 * 3. Copy your Project URL and anon/public key
 * 4. Replace the values below
 * 
 * STORAGE BUCKET SETUP:
 * 1. Go to Storage in Supabase dashboard
 * 2. Create a new bucket named 'incident-images'
 * 3. Set it to Public or configure RLS policies
 * 4. Enable file upload limits (e.g., max 10MB)
 */

// TODO: Replace with your Supabase credentials
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

/**
 * Supabase client instance
 * Used for all Supabase operations including Storage
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // We're not using Supabase auth, just storage
  },
});

/**
 * Storage bucket configuration
 */
export const STORAGE_CONFIG = {
  BUCKET_NAME: 'incident-images',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
};

/**
 * Get public URL for an uploaded image
 * @param path - The path to the file in the bucket
 * @returns Public URL to access the image
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(STORAGE_CONFIG.BUCKET_NAME)
    .getPublicUrl(path);
  
  return data.publicUrl;
}

/**
 * Check if Supabase is properly configured
 * @returns true if credentials are set, false otherwise
 */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL !== 'https://your-project-id.supabase.co' &&
    SUPABASE_ANON_KEY !== 'your-anon-key-here'
  );
}

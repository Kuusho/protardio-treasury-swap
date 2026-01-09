import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Factory for Whitelist Registration
 * 
 * SECURITY NOTES:
 * - This module only exports server-side clients using the service_role key
 * - The service_role key has full database access and must NEVER be exposed to the frontend
 * - All database operations should happen through API routes, not client-side code
 * - RLS policies provide an additional layer of protection in case of misconfiguration
 * - The SUPABASE_SERVICE_ROLE_KEY env var intentionally lacks the NEXT_PUBLIC_ prefix
 *   to ensure Next.js doesn't bundle it into client-side code
 */

/**
 * Creates a Supabase client with service role privileges.
 * 
 * ⚠️ WARNING: Only use this in API routes (server-side).
 * Never import this module in client components.
 * 
 * @throws Error if required environment variables are missing
 * @returns Supabase client with admin privileges
 */
export const createServerClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }
  
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

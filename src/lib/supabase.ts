import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** True only when both public build-time values are present. */
export const isSupabaseConfigured = Boolean(url && key)

/**
 * Browser client. Null when the site was built without the public Supabase
 * URL or publishable key, so the app can render a notice instead of throwing.
 * This module never reads a service-role or secret key.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null

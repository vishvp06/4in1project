/*
 * Public browser configuration for 4IN1.
 * Supports environment variable overrides if injected, with default Supabase fallback.
 */
window.FourInOneSupabaseConfig = Object.freeze({
  url: window.ENV_SUPABASE_URL || 'https://pbuokbjhudbyawmmobxj.supabase.co',
  publishableKey: window.ENV_SUPABASE_KEY || 'sb_publishable_X_f_Zi41tuSLyioKnY7_3w_DyDyooJe',
  storageBucket: 'payment-qr',
  provider: 'phonepe'
});

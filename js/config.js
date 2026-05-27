// Discover Together — Supabase connection config.
//
// The publishable key is intentionally safe to commit. All tables have
// RLS enabled with no policies, so this key cannot read or write data
// directly — it can only call the SECURITY DEFINER RPC functions
// defined in /supabase/schema.sql.

window.DT_CONFIG = {
  SUPABASE_URL: "https://csqscdthxqfbgihuabkd.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_S3Pl2Qr_wf1HwraZJ44xUA_mXMXOINz",

  // App-fixed salt for the SHA-256 PIN hash performed in the browser.
  // Changing this invalidates every existing couple's PIN.
  PIN_HASH_SALT: "discover-together::v1::pin-salt::Z9aQpKx2"
};

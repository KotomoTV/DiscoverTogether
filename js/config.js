// Crave — Supabase connection config.
//
// The publishable key is intentionally safe to commit. All tables have
// RLS enabled with no policies, so this key cannot read or write data
// directly — it can only call the SECURITY DEFINER RPC functions
// defined in /supabase/schema.sql.

window.CRAVE_CONFIG = {
  SUPABASE_URL: "https://csqscdthxqfbgihuabkd.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_S3Pl2Qr_wf1HwraZJ44xUA_mXMXOINz",

  // App-fixed salt for the SHA-256 code hash performed in the browser.
  // Changing this invalidates every existing couple's code.
  CODE_HASH_SALT: "crave::v1::code-salt::Z9aQpKx2"
};

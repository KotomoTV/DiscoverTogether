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
  CODE_HASH_SALT: "crave::v1::code-salt::Z9aQpKx2",

  // Temporary diagnostics flag. While true:
  //   - every submit_answer call is logged with {match_key, response}
  //   - get_results payload is logged on the result screen
  //   - the result screen also renders an inline debug strip when the
  //     payload contains zero matches, so mobile users can see what
  //     came back without remote DevTools.
  // Flip to false (or remove the line) when the pairing bug has been
  // root-caused and confirmed fixed.
  CRAVE_DEBUG: true
};


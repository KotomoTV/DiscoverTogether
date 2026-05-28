// Crave — full question deck.
//
// Schema (per the build brief):
//   id          string, unique across the master list
//   audience    'her' | 'him' | 'both'   — gates who sees this card
//   matchKey    string                    — pairs complementary her/him items
//                                           so they compare on the result screen
//   category    string                    — phase / theme label
//   text        string                    — variable phrase rendered inside the
//                                           question tile (the fixed stem
//                                           "What do you think about" lives
//                                           in the screen, not the data)
//   resultLabel string                    — neutral wording for the result
//                                           cards (per matchKey)
//   icon        string                    — name of an entry in Q_ICONS in
//                                           js/app.js; falls back to 'heart'
//                                           if the name is unknown
//
// Deck filtering:
//   woman → audience === 'both' || audience === 'her'
//   man   → audience === 'both' || audience === 'him'
//
// The 8 originally-split items each become two entries (one 'her', one 'him')
// sharing a matchKey, so each user sees one phrasing and the result screen
// can still pair them up. 41 'both' + 16 split entries = 57 master items;
// each user's deck is 41 + 8 = 49 cards.

window.CRAVE_QUESTIONS = [
  // ---- Sensual Connection ----
  { id: 'bathing_candlelight', audience: 'both', matchKey: 'bathing_candlelight',
    category: 'Sensual Connection', icon: 'bath',
    text: 'bathing together by candlelight',
    resultLabel: 'Bathing together by candlelight' },
  { id: 'erotic_massages', audience: 'both', matchKey: 'erotic_massages',
    category: 'Sensual Connection', icon: 'sparkles',
    text: 'giving each other erotic massages',
    resultLabel: 'Erotic massages for each other' },
  { id: 'shower_sex', audience: 'both', matchKey: 'shower_sex',
    category: 'Sensual Connection', icon: 'droplet',
    text: 'having sex in the shower',
    resultLabel: 'Sex in the shower' },
  { id: 'naked_day_home', audience: 'both', matchKey: 'naked_day_home',
    category: 'Sensual Connection', icon: 'bed',
    text: 'spending a whole day naked together at home',
    resultLabel: 'A whole day naked together at home' },
  { id: 'feather_play', audience: 'both', matchKey: 'feather_play',
    category: 'Sensual Connection', icon: 'sparkles',
    text: 'sensation play with feathers and soft textures',
    resultLabel: 'Sensation play with feathers and soft textures' },
  { id: 'eye_contact_sex', audience: 'both', matchKey: 'eye_contact_sex',
    category: 'Sensual Connection', icon: 'heart',
    text: 'sex with only eye contact and no words',
    resultLabel: 'Sex with only eye contact, no words' },

  // ---- Comfort and Rhythm ----
  { id: 'lights_on', audience: 'both', matchKey: 'lights_on',
    category: 'Comfort and Rhythm', icon: 'heart',
    text: 'having sex with the lights fully on',
    resultLabel: 'Sex with the lights fully on' },
  { id: 'lights_off', audience: 'both', matchKey: 'lights_off',
    category: 'Comfort and Rhythm', icon: 'moon',
    text: 'having sex in complete darkness',
    resultLabel: 'Sex in complete darkness' },
  { id: 'position_per_week', audience: 'both', matchKey: 'position_per_week',
    category: 'Comfort and Rhythm', icon: 'bed',
    text: 'trying a new position every week for a month',
    resultLabel: 'A new position every week for a month' },
  { id: 'morning_sex_week', audience: 'both', matchKey: 'morning_sex_week',
    category: 'Comfort and Rhythm', icon: 'bed',
    text: 'having morning sex every day for a week',
    resultLabel: 'Morning sex every day for a week' },
  { id: 'quickie_morning', audience: 'both', matchKey: 'quickie_morning',
    category: 'Comfort and Rhythm', icon: 'bed',
    text: 'a quickie in the morning before work',
    resultLabel: 'A quickie in the morning before work' },
  { id: 'mutual_masturbation', audience: 'both', matchKey: 'mutual_masturbation',
    category: 'Comfort and Rhythm', icon: 'heart',
    text: 'mutual masturbation while watching each other',
    resultLabel: 'Mutual masturbation, watching each other' },

  // ---- Adventure and Locations ----
  { id: 'beach_night', audience: 'both', matchKey: 'beach_night',
    category: 'Adventure and Locations', icon: 'moon',
    text: 'having sex on a beach at night',
    resultLabel: 'Sex on a beach at night' },
  { id: 'outdoors_nature', audience: 'both', matchKey: 'outdoors_nature',
    category: 'Adventure and Locations', icon: 'tree',
    text: 'having sex outdoors in nature',
    resultLabel: 'Sex outdoors in nature' },
  { id: 'hotel_pool', audience: 'both', matchKey: 'hotel_pool',
    category: 'Adventure and Locations', icon: 'droplet',
    text: 'having sex in a hotel pool or hot tub',
    resultLabel: 'Sex in a hotel pool or hot tub' },
  { id: 'balcony_rooftop', audience: 'both', matchKey: 'balcony_rooftop',
    category: 'Adventure and Locations', icon: 'tree',
    text: 'having sex on a balcony or rooftop',
    resultLabel: 'Sex on a balcony or rooftop' },
  { id: 'sex_in_car', audience: 'both', matchKey: 'sex_in_car',
    category: 'Adventure and Locations', icon: 'plane',
    text: 'having sex in a car',
    resultLabel: 'Sex in a car' },
  { id: 'sex_on_boat', audience: 'both', matchKey: 'sex_on_boat',
    category: 'Adventure and Locations', icon: 'plane',
    text: 'having sex on a boat',
    resultLabel: 'Sex on a boat' },
  { id: 'elevator', audience: 'both', matchKey: 'elevator',
    category: 'Adventure and Locations', icon: 'heart',
    text: 'having sex in an elevator',
    resultLabel: 'Sex in an elevator' },
  { id: 'movie_theater', audience: 'both', matchKey: 'movie_theater',
    category: 'Adventure and Locations', icon: 'tv',
    text: 'having sex in the back row of a movie theater',
    resultLabel: 'Sex in the back row of a movie theater' },

  // ---- Outings and Venues ----
  { id: 'sex_shop', audience: 'both', matchKey: 'sex_shop',
    category: 'Outings and Venues', icon: 'heart',
    text: 'browsing a sex shop together',
    resultLabel: 'Browsing a sex shop together' },
  { id: 'couples_massage', audience: 'both', matchKey: 'couples_massage',
    category: 'Outings and Venues', icon: 'sparkles',
    text: "getting couples' erotic massages",
    resultLabel: "Couples' erotic massages" },
  { id: 'strip_club', audience: 'both', matchKey: 'strip_club',
    category: 'Outings and Venues', icon: 'music',
    text: 'going to a strip club together',
    resultLabel: 'Going to a strip club together' },
  { id: 'clothing_optional_resort', audience: 'both', matchKey: 'clothing_optional_resort',
    category: 'Outings and Venues', icon: 'plane',
    text: 'visiting a clothing-optional resort',
    resultLabel: 'Visiting a clothing-optional resort' },

  // ---- Dressing Up, Toys, and Atmosphere ----
  { id: 'lingerie_her', audience: 'her', matchKey: 'lingerie_chosen',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'mask',
    text: 'wearing lingerie your partner chose for you',
    resultLabel: 'Lingerie he picks out for her to wear' },
  { id: 'lingerie_him', audience: 'him', matchKey: 'lingerie_chosen',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'mask',
    text: 'choosing lingerie for your partner to wear',
    resultLabel: 'Lingerie he picks out for her to wear' },
  { id: 'porn_during_sex', audience: 'both', matchKey: 'porn_during_sex',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'tv',
    text: 'watching porn together during sex',
    resultLabel: 'Watching porn together during sex' },
  { id: 'vibrator_solo_her', audience: 'her', matchKey: 'vibrator_solo_watched',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'heart',
    text: 'getting an orgasm using a vibrator on your own while your partner watches',
    resultLabel: 'Her using a vibrator on her own while he watches' },
  { id: 'vibrator_solo_him', audience: 'him', matchKey: 'vibrator_solo_watched',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'heart',
    text: 'watching your partner get an orgasm using a vibrator on her own',
    resultLabel: 'Her using a vibrator on her own while he watches' },
  { id: 'sex_in_mirror', audience: 'both', matchKey: 'sex_in_mirror',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'heart',
    text: 'having sex in front of a mirror',
    resultLabel: 'Sex in front of a mirror' },
  { id: 'temperature_play', audience: 'both', matchKey: 'temperature_play',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'glass',
    text: 'trying temperature play (ice, warm wax)',
    resultLabel: 'Temperature play (ice, warm wax)' },

  // ---- Recording and Voyeurism ----
  { id: 'intimate_video_calls', audience: 'both', matchKey: 'intimate_video_calls',
    category: 'Recording and Voyeurism', icon: 'tv',
    text: 'video calling each other intimately when apart',
    resultLabel: 'Intimate video calls when apart' },
  { id: 'filming_private', audience: 'both', matchKey: 'filming_private',
    category: 'Recording and Voyeurism', icon: 'camera',
    text: 'filming yourselves having sex (kept private)',
    resultLabel: 'Filming yourselves having sex (kept private)' },
  { id: 'watching_home_video', audience: 'both', matchKey: 'watching_home_video',
    category: 'Recording and Voyeurism', icon: 'tv',
    text: 'watching your own home video together later',
    resultLabel: 'Watching your own home video together later' },

  // ---- Power Dynamics ----
  { id: 'partner_full_control', audience: 'both', matchKey: 'partner_full_control',
    category: 'Power Dynamics', icon: 'mask',
    text: 'letting your partner take full control for a night',
    resultLabel: 'Letting your partner take full control for a night' },
  { id: 'you_full_control', audience: 'both', matchKey: 'you_full_control',
    category: 'Power Dynamics', icon: 'mask',
    text: 'taking full control of your partner for a night',
    resultLabel: 'Taking full control of your partner for a night' },
  { id: 'told_what_to_do', audience: 'both', matchKey: 'told_what_to_do',
    category: 'Power Dynamics', icon: 'message',
    text: 'being told exactly what to do during sex',
    resultLabel: 'Being told exactly what to do during sex' },
  { id: 'light_spanking', audience: 'both', matchKey: 'light_spanking',
    category: 'Power Dynamics', icon: 'heart',
    text: 'light spanking during sex',
    resultLabel: 'Light spanking during sex' },
  { id: 'hair_pulling_her', audience: 'her', matchKey: 'hair_pulling',
    category: 'Power Dynamics', icon: 'heart',
    text: 'having your hair pulled and being kissed roughly by your partner',
    resultLabel: 'Hair pulling and rough kissing (him to her)' },
  { id: 'hair_pulling_him', audience: 'him', matchKey: 'hair_pulling',
    category: 'Power Dynamics', icon: 'heart',
    text: "pulling your partner's hair and kissing her roughly",
    resultLabel: 'Hair pulling and rough kissing (him to her)' },
  { id: 'blindfold_her', audience: 'her', matchKey: 'blindfold',
    category: 'Power Dynamics', icon: 'eye-off',
    text: 'being blindfolded by your partner during sex',
    resultLabel: 'Him blindfolding her during sex' },
  { id: 'blindfold_him', audience: 'him', matchKey: 'blindfold',
    category: 'Power Dynamics', icon: 'eye-off',
    text: 'blindfolding your partner during sex',
    resultLabel: 'Him blindfolding her during sex' },
  { id: 'handcuffs_her', audience: 'her', matchKey: 'handcuffs',
    category: 'Power Dynamics', icon: 'heart',
    text: 'being handcuffed by your partner during sex',
    resultLabel: 'Him handcuffing her during sex' },
  { id: 'handcuffs_him', audience: 'him', matchKey: 'handcuffs',
    category: 'Power Dynamics', icon: 'heart',
    text: 'handcuffing your partner during sex',
    resultLabel: 'Him handcuffing her during sex' },
  { id: 'hidden_vibrator_her', audience: 'her', matchKey: 'hidden_vibrator',
    category: 'Power Dynamics', icon: 'heart',
    text: 'wearing a hidden vibrator in public while your partner controls it',
    resultLabel: 'A hidden vibrator she wears in public, he controls it' },
  { id: 'hidden_vibrator_him', audience: 'him', matchKey: 'hidden_vibrator',
    category: 'Power Dynamics', icon: 'heart',
    text: 'controlling a hidden vibrator your partner is wearing in public',
    resultLabel: 'A hidden vibrator she wears in public, he controls it' },

  // ---- Couple's Intimate Exploration ----
  { id: 'soft_anal_her', audience: 'her', matchKey: 'soft_anal',
    category: "Couple's Intimate Exploration", icon: 'heart',
    text: 'receiving soft, slow anal sex from your partner (with plenty of preparation)',
    resultLabel: 'Soft, slow anal sex (him giving, her receiving) with plenty of preparation' },
  { id: 'soft_anal_him', audience: 'him', matchKey: 'soft_anal',
    category: "Couple's Intimate Exploration", icon: 'heart',
    text: 'giving soft, slow anal sex to your partner (with plenty of preparation)',
    resultLabel: 'Soft, slow anal sex (him giving, her receiving) with plenty of preparation' },
  { id: 'silicone_doll_her', audience: 'her', matchKey: 'silicone_doll',
    category: "Couple's Intimate Exploration", icon: 'heart',
    text: 'watching your partner have sex with a silicone sex doll while you are nearby',
    resultLabel: "Him with a silicone sex doll while she's nearby" },
  { id: 'silicone_doll_him', audience: 'him', matchKey: 'silicone_doll',
    category: "Couple's Intimate Exploration", icon: 'heart',
    text: 'having sex with a silicone sex doll while your partner is nearby',
    resultLabel: "Him with a silicone sex doll while she's nearby" },

  // ---- Multi-Partner Exploration ----
  { id: 'watched_by_couple', audience: 'both', matchKey: 'watched_by_couple',
    category: 'Multi-Partner Exploration', icon: 'heart',
    text: 'being watched by another couple while having sex',
    resultLabel: 'Being watched by another couple while having sex' },
  { id: 'soft_swap', audience: 'both', matchKey: 'soft_swap',
    category: 'Multi-Partner Exploration', icon: 'sparkles',
    text: 'soft swap (kissing and touching only) with another couple',
    resultLabel: 'Soft swap (kissing and touching only) with another couple' },
  { id: 'swingers_club', audience: 'both', matchKey: 'swingers_club',
    category: 'Multi-Partner Exploration', icon: 'music',
    text: 'going to a swingers club together',
    resultLabel: 'Going to a swingers club together' },
  { id: 'plus_another_woman', audience: 'both', matchKey: 'plus_another_woman',
    category: 'Multi-Partner Exploration', icon: 'heart',
    text: 'having sex with your partner and another woman',
    resultLabel: 'Sex with your partner and another woman' },
  { id: 'plus_another_man', audience: 'both', matchKey: 'plus_another_man',
    category: 'Multi-Partner Exploration', icon: 'heart',
    text: 'having sex with your partner and another man',
    resultLabel: 'Sex with your partner and another man' },
  { id: 'plus_a_ladyboy', audience: 'both', matchKey: 'plus_a_ladyboy',
    category: 'Multi-Partner Exploration', icon: 'heart',
    text: 'having sex with your partner and a ladyboy',
    resultLabel: 'Sex with your partner and a ladyboy' },

  // ---- Reflection ----
  { id: 'never_want_to_try', audience: 'both', matchKey: 'never_want_to_try',
    category: 'Reflection', icon: 'message',
    text: "discussing what you'd never want to try, and why",
    resultLabel: "Discussing what you'd never want to try, and why" }
];

// Helpers — kept here so questions stay the single source of truth.

window.CRAVE_QUESTIONS_BY_ID = (function () {
  var byId = Object.create(null);
  for (var i = 0; i < window.CRAVE_QUESTIONS.length; i++) {
    var q = window.CRAVE_QUESTIONS[i];
    byId[q.id] = q;
  }
  return byId;
})();

// Result label per matchKey (paired her/him items share the same label).
window.CRAVE_RESULT_LABEL = (function () {
  var byKey = Object.create(null);
  for (var i = 0; i < window.CRAVE_QUESTIONS.length; i++) {
    var q = window.CRAVE_QUESTIONS[i];
    if (!byKey[q.matchKey]) byKey[q.matchKey] = q.resultLabel;
  }
  return byKey;
})();

// Build a per-gender deck in stable display order.
//   gender === 'woman' → keep 'both' + 'her'
//   gender === 'man'   → keep 'both' + 'him'
window.craveDeckForGender = function (gender) {
  var keepAudience = gender === 'woman' ? 'her' : 'him';
  var out = [];
  for (var i = 0; i < window.CRAVE_QUESTIONS.length; i++) {
    var q = window.CRAVE_QUESTIONS[i];
    if (q.audience === 'both' || q.audience === keepAudience) out.push(q);
  }
  return out;
};

// Crave — full question deck.
//
// Schema:
//   id          string, unique across the master list
//   audience    'her' | 'him' | 'both'   — gates who sees this card
//   matchKey    string                    — pairs complementary her/him items
//                                           so they compare on the result screen
//   category    string                    — phase / theme label
//   text        string                    — variable phrase rendered inside the
//                                           question tile (the fixed stem
//                                           "What do you think about" lives in
//                                           the screen, not the data). Stored
//                                           lowercase; the card uppercases.
//   resultLabel string                    — neutral wording for the result
//                                           cards (paired her/him items share
//                                           the same label)
//   icon        string                    — name of an entry in Q_ICONS in
//                                           js/app.js. Every question carries
//                                           a deliberate icon; no generic
//                                           fallback in normal operation.
//
// Deck filtering:
//   woman → audience === 'both' || audience === 'her'
//   man   → audience === 'both' || audience === 'him'
//
// 28 'both' + 8 split pairs (each pair = 1 'her' + 1 'him' sharing a
// matchKey) = 44 master entries. Each user's deck is 28 + 8 = 36 cards.

window.CRAVE_QUESTIONS = [
  // ---- Sensual Connection ----
  { id: 'bath_together', audience: 'both', matchKey: 'bath-together',
    category: 'Sensual Connection', icon: 'bath',
    text: 'bathing together',
    resultLabel: 'Bathing together' },
  { id: 'mutual_massage', audience: 'both', matchKey: 'mutual-massage',
    category: 'Sensual Connection', icon: 'hands',
    text: 'slowly massaging each other all over',
    resultLabel: 'Slowly massaging each other all over' },
  { id: 'shower_sex', audience: 'both', matchKey: 'shower-sex',
    category: 'Sensual Connection', icon: 'droplet',
    text: 'having sex in the shower',
    resultLabel: 'Sex in the shower' },
  { id: 'feather_teasing', audience: 'both', matchKey: 'feather-teasing',
    category: 'Sensual Connection', icon: 'feather',
    text: 'being teased all over with feathers and soft fabrics',
    resultLabel: 'Being teased with feathers and soft fabrics' },
  { id: 'eye_contact_silent', audience: 'both', matchKey: 'eye-contact-silent',
    category: 'Sensual Connection', icon: 'eye',
    text: 'sex with only eye contact and no words',
    resultLabel: 'Sex with only eye contact, no words' },

  // ---- Comfort and Rhythm ----
  { id: 'lights_on', audience: 'both', matchKey: 'lights-on',
    category: 'Comfort and Rhythm', icon: 'bulb',
    text: 'having sex with the lights fully on',
    resultLabel: 'Sex with the lights fully on' },
  { id: 'new_position_weekly', audience: 'both', matchKey: 'new-position-weekly',
    category: 'Comfort and Rhythm', icon: 'rotate',
    text: 'trying a new position every week for a month',
    resultLabel: 'A new position every week for a month' },
  { id: 'morning_sex_week', audience: 'both', matchKey: 'morning-sex-week',
    category: 'Comfort and Rhythm', icon: 'sunrise',
    text: 'having morning sex every day for a week',
    resultLabel: 'Morning sex every day for a week' },
  { id: 'touch_yourself_watched', audience: 'both', matchKey: 'touch-yourself-watched',
    category: 'Comfort and Rhythm', icon: 'hand',
    text: 'touching yourself while your partner is watching',
    resultLabel: 'Touching yourself while your partner watches' },

  // ---- Adventure and Locations ----
  { id: 'outdoors_nature', audience: 'both', matchKey: 'outdoors-nature',
    category: 'Adventure and Locations', icon: 'tree',
    text: 'having sex outdoors in nature',
    resultLabel: 'Sex outdoors in nature' },
  { id: 'car_sex', audience: 'both', matchKey: 'car-sex',
    category: 'Adventure and Locations', icon: 'car',
    text: 'having sex in a car',
    resultLabel: 'Sex in a car' },
  { id: 'boat_sex', audience: 'both', matchKey: 'boat-sex',
    category: 'Adventure and Locations', icon: 'sailboat',
    text: 'having sex on a boat',
    resultLabel: 'Sex on a boat' },
  { id: 'cinema_backrow', audience: 'both', matchKey: 'cinema-backrow',
    category: 'Adventure and Locations', icon: 'movie',
    text: 'having sex in the back row of a dark cinema',
    resultLabel: 'Sex in the back row of a dark cinema' },

  // ---- Outings and Venues ----
  { id: 'sexshop_gift', audience: 'both', matchKey: 'sexshop-gift',
    category: 'Outings and Venues', icon: 'shopping-bag',
    text: 'browsing a sex shop together and buying something for your partner',
    resultLabel: 'Browsing a sex shop and buying something for your partner' },
  { id: 'couples_massage', audience: 'both', matchKey: 'couples-massage',
    category: 'Outings and Venues', icon: 'spa',
    text: 'receiving a couples erotic massage',
    resultLabel: 'A couples erotic massage' },
  { id: 'strip_club', audience: 'both', matchKey: 'strip-club',
    category: 'Outings and Venues', icon: 'music',
    text: 'going to a strip club together',
    resultLabel: 'Going to a strip club together' },
  { id: 'nudist_resort', audience: 'both', matchKey: 'nudist-resort',
    category: 'Outings and Venues', icon: 'beach',
    text: 'spending a weekend at a nudist resort',
    resultLabel: 'A weekend at a nudist resort' },

  // ---- Dressing Up, Toys, and Atmosphere ----
  { id: 'lingerie_chosen_her', audience: 'her', matchKey: 'lingerie-chosen',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'hanger',
    text: 'wearing lingerie your partner chose for you',
    resultLabel: 'Lingerie he picks out for her to wear' },
  { id: 'lingerie_chosen_him', audience: 'him', matchKey: 'lingerie-chosen',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'hanger',
    text: 'choosing lingerie for your partner to wear',
    resultLabel: 'Lingerie he picks out for her to wear' },
  { id: 'porn_before_sex', audience: 'both', matchKey: 'porn-before-sex',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'tv',
    text: 'watching porn together before sex',
    resultLabel: 'Watching porn together before sex' },
  { id: 'vibrator_watched_her', audience: 'her', matchKey: 'vibrator-watched',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'bolt',
    text: 'getting an orgasm using a vibrator on your own while your partner watches',
    resultLabel: 'Her using a vibrator on her own while he watches' },
  { id: 'vibrator_watched_him', audience: 'him', matchKey: 'vibrator-watched',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'bolt',
    text: 'watching your partner get an orgasm using a vibrator on her own',
    resultLabel: 'Her using a vibrator on her own while he watches' },
  { id: 'mirror_sex', audience: 'both', matchKey: 'mirror-sex',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'mirror',
    text: 'watching yourselves make love in front of a mirror',
    resultLabel: 'Watching yourselves make love in a mirror' },
  { id: 'temperature_play', audience: 'both', matchKey: 'temperature-play',
    category: 'Dressing Up, Toys, and Atmosphere', icon: 'snowflake',
    text: 'teasing each other with ice and warm wax on bare skin',
    resultLabel: 'Teasing with ice and warm wax on bare skin' },

  // ---- Recording and Voyeurism ----
  { id: 'intimate_videocall', audience: 'both', matchKey: 'intimate-videocall',
    category: 'Recording and Voyeurism', icon: 'video',
    text: 'video calling each other intimately when apart',
    resultLabel: 'Intimate video calls when apart' },
  { id: 'filming_private', audience: 'both', matchKey: 'filming-private',
    category: 'Recording and Voyeurism', icon: 'video-camera',
    text: 'filming yourselves making love, just for the two of you',
    resultLabel: 'Filming yourselves making love, just for the two of you' },

  // ---- Power Dynamics ----
  { id: 'surrender_control', audience: 'both', matchKey: 'surrender-control',
    category: 'Power Dynamics', icon: 'lock-open',
    text: 'surrendering completely, letting your partner take control for a night',
    resultLabel: 'Surrendering, letting your partner take control for a night' },
  { id: 'take_control', audience: 'both', matchKey: 'take-control',
    category: 'Power Dynamics', icon: 'crown',
    text: 'taking full control of your partner for a night',
    resultLabel: 'Taking full control of your partner for a night' },
  { id: 'playful_spanking', audience: 'both', matchKey: 'playful-spanking',
    category: 'Power Dynamics', icon: 'palm',
    text: 'a little playful spanking while you make love',
    resultLabel: 'A little playful spanking' },
  { id: 'hair_pull_rough_her', audience: 'her', matchKey: 'hair-pull-rough',
    category: 'Power Dynamics', icon: 'flame',
    text: 'having your hair pulled and being kissed roughly by your partner',
    resultLabel: 'Hair pulling and rough kissing (him to her)' },
  { id: 'hair_pull_rough_him', audience: 'him', matchKey: 'hair-pull-rough',
    category: 'Power Dynamics', icon: 'flame',
    text: "pulling your partner's hair and kissing her roughly",
    resultLabel: 'Hair pulling and rough kissing (him to her)' },
  { id: 'blindfold_her', audience: 'her', matchKey: 'blindfold',
    category: 'Power Dynamics', icon: 'eye-off',
    text: "being blindfolded, every touch a surprise you can't see coming",
    resultLabel: 'Him blindfolding her, every touch a surprise' },
  { id: 'blindfold_him', audience: 'him', matchKey: 'blindfold',
    category: 'Power Dynamics', icon: 'eye-off',
    text: 'blindfolding your partner so every touch takes her by surprise',
    resultLabel: 'Him blindfolding her, every touch a surprise' },
  { id: 'handcuffs_her', audience: 'her', matchKey: 'handcuffs',
    category: 'Power Dynamics', icon: 'lock',
    text: 'being handcuffed by your partner during sex',
    resultLabel: 'Him handcuffing her during sex' },
  { id: 'handcuffs_him', audience: 'him', matchKey: 'handcuffs',
    category: 'Power Dynamics', icon: 'lock',
    text: 'handcuffing your partner during sex',
    resultLabel: 'Him handcuffing her during sex' },
  { id: 'hidden_public_toy_her', audience: 'her', matchKey: 'hidden-public-toy',
    category: 'Power Dynamics', icon: 'remote',
    text: 'wearing a hidden toy in public while your partner secretly controls it',
    resultLabel: 'A hidden toy she wears in public, he secretly controls it' },
  { id: 'hidden_public_toy_him', audience: 'him', matchKey: 'hidden-public-toy',
    category: 'Power Dynamics', icon: 'remote',
    text: 'secretly controlling a hidden toy your partner is wearing in public',
    resultLabel: 'A hidden toy she wears in public, he secretly controls it' },

  // ---- Couple's Intimate Exploration ----
  { id: 'slow_anal_her', audience: 'her', matchKey: 'slow-anal',
    category: "Couple's Intimate Exploration", icon: 'heart',
    text: 'slow, gentle anal play, taken fully at your pace',
    resultLabel: 'Slow, gentle anal play, taken at her pace' },
  { id: 'slow_anal_him', audience: 'him', matchKey: 'slow-anal',
    category: "Couple's Intimate Exploration", icon: 'heart',
    text: 'slow, gentle anal play with your partner, taking all the time she needs',
    resultLabel: 'Slow, gentle anal play, taken at her pace' },
  { id: 'silicone_doll_her', audience: 'her', matchKey: 'silicone-doll',
    category: "Couple's Intimate Exploration", icon: 'robot',
    text: "watching your partner enjoy a silicone doll while you're right there beside them",
    resultLabel: 'Him with a silicone doll while she watches beside them' },
  { id: 'silicone_doll_him', audience: 'him', matchKey: 'silicone-doll',
    category: "Couple's Intimate Exploration", icon: 'robot',
    text: 'enjoying a silicone doll while your partner watches close by',
    resultLabel: 'Him with a silicone doll while she watches beside them' },

  // ---- Multi-Partner Exploration ----
  { id: 'threesome_woman', audience: 'both', matchKey: 'threesome-woman',
    category: 'Multi-Partner Exploration', icon: 'users-w',
    text: 'having sex with your partner and another woman',
    resultLabel: 'Sex with your partner and another woman' },
  { id: 'threesome_man', audience: 'both', matchKey: 'threesome-man',
    category: 'Multi-Partner Exploration', icon: 'users-m',
    text: 'having sex with your partner and another man',
    resultLabel: 'Sex with your partner and another man' },
  { id: 'threesome_ladyboy', audience: 'both', matchKey: 'threesome-ladyboy',
    category: 'Multi-Partner Exploration', icon: 'users-x',
    text: 'having sex with your partner and a ladyboy',
    resultLabel: 'Sex with your partner and a ladyboy' }
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

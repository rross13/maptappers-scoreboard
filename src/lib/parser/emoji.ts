/**
 * Unicode emoji to Slack shortcode.
 *
 * Hand-written rather than pulled from node-emoji/emoji-toolkit: those packages
 * disagree with Slack on exactly the names this parser depends on (`:red_square:`
 * vs `:large_red_square:`), and they are hundreds of KB in a client bundle.
 *
 * Only structurally significant emoji need to be here — the tiles, squares and
 * anchor markers the regexes actually match on. MapTap's per-round emoji are
 * deliberately NOT exhaustive: that set changes with the score bands and is
 * open-ended, so the MapTap regex matches any pictographic cluster instead of
 * relying on this table.
 */

export const EMOJI_TO_SHORTCODE: Record<string, string> = {
  // Coloured squares — Globle and Size It Up grids
  "\u{1F7E5}": "large_red_square",
  "\u{1F7E7}": "large_orange_square",
  "\u{1F7E8}": "large_yellow_square",
  "\u{1F7E9}": "large_green_square",
  "\u{1F7E6}": "large_blue_square",
  "\u{1F7EA}": "large_purple_square",
  "\u{1F7EB}": "large_brown_square",
  "⬜": "white_large_square",
  "⬛": "black_large_square",

  // Krillion tiles
  "\u{1F41F}": "fish",
  "\u{1FAE7}": "bubbles",
  "\u{1F991}": "squid",
  "\u{1F3EE}": "izakaya_lantern",
  "\u{1F31F}": "star2",
  "\u{1F990}": "shrimp",

  // Globle header
  "\u{1F30E}": "earth_americas",
  "\u{1F30D}": "earth_africa",
  "\u{1F30F}": "earth_asia",
  "\u{1F525}": "fire",

  // Common MapTap round markers. Present so round emoji round-trip for display;
  // parsing does not depend on this list being complete.
  "\u{1F3AF}": "dart",
  "\u{1F3C6}": "trophy",
  "\u{1F3C5}": "sports_medal",
  "\u{1F393}": "mortar_board",
  "\u{1F451}": "crown",
  "\u{1F389}": "tada",
  "\u{1F44F}": "clap",
  "✨": "sparkles",
  "\u{1F31E}": "sun_with_face",
  "\u{1F601}": "grin",
  "\u{1F602}": "joy",
  "\u{1F614}": "pensive",
  "\u{1F628}": "fearful",
  "\u{1F92E}": "face_vomiting",
  "\u{1F928}": "face_with_raised_eyebrow",
  "\u{1F92B}": "shushing_face",
  "\u{1F917}": "hugging_face",
  "\u{1F642}": "slightly_smiling_face",
  "\u{1F610}": "neutral_face",
  "\u{1F643}": "upside_down_face",
  "\u{1FAE2}": "face_with_open_eyes_and_hand_over_mouth",
  "\u{1F97A}": "pleading_face",
  "\u{1F62D}": "sob",
  "\u{1F480}": "skull",
  "\u{1F61E}": "disappointed",
  "\u{1F605}": "sweat_smile",
};

/** Slack shortcode aliases seen in the wild, normalized to one spelling. */
export const SHORTCODE_ALIASES: Record<string, string> = {
  red_square: "large_red_square",
  orange_square: "large_orange_square",
  yellow_square: "large_yellow_square",
  green_square: "large_green_square",
  blue_square: "large_blue_square",
  purple_square: "large_purple_square",
  brown_square: "large_brown_square",
  white_square: "white_large_square",
  black_square: "black_large_square",
  earth_america: "earth_americas",
};

/** Reverse map, for rendering a stored shortcode back as an emoji. */
export const SHORTCODE_TO_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(EMOJI_TO_SHORTCODE).map(([e, s]) => [s, e]),
);

/** Matches one emoji cluster: base pictograph, optional VS16, optional ZWJ runs. */
export const EMOJI_CLUSTER =
  /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;

import {
  EMOJI_CLUSTER,
  EMOJI_TO_SHORTCODE,
  SHORTCODE_ALIASES,
} from "./emoji";

/**
 * Canonicalizes pasted text so the game regexes only ever see one spelling.
 *
 * INVARIANT: line-count preserving. Every transform operates within a line and
 * nothing inserts or removes a newline, so index `i` refers to the same line
 * before and after. That is what lets an error quote the user's original text.
 *
 * The canonical internal form is Slack shortcodes, not Unicode: it is ASCII, so
 * there are no surrogate pairs, ZWJ sequences or VS16 ambiguity to write regexes
 * against, and it already matches most real pastes.
 */

const SKIN_TONES = /[\u{1F3FB}-\u{1F3FF}]/gu;

function decodeEntities(s: string): string {
  // Slack emits only these three.
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function delinkify(s: string): string {
  return (
    s
      // <url|label> -> label. Label-preferred is what keeps
      // "<http://www.maptap.gg|www.maptap.gg> September 18" matching the anchor.
      .replace(/<(https?:\/\/[^|>\s]+)\|([^>\n]*)>/g, "$2")
      .replace(/<(https?:\/\/[^>\s|]+)>/g, "$1")
      // Channel and user mentions keep their label.
      .replace(/<(?:#C[A-Z0-9]+|@[UW][A-Z0-9]+)\|([^>\n]*)>/g, "$1")
      .replace(/<!(?:here|channel|everyone)>/g, "")
  );
}

function emojiToShortcodes(s: string): string {
  return s.replace(EMOJI_CLUSTER, (cluster) => {
    const key = cluster.replace(/️/g, "").replace(SKIN_TONES, "");
    const name = EMOJI_TO_SHORTCODE[key];
    // Unknown emoji are left intact. They are commentary, and replacing them
    // with a placeholder could accidentally satisfy a tile-row regex.
    return name ? `:${name}:` : cluster;
  });
}

function normalizeAliases(s: string): string {
  return s.replace(/:([a-z0-9_+-]+):/g, (whole, name: string) => {
    const canonical = SHORTCODE_ALIASES[name];
    return canonical ? `:${canonical}:` : whole;
  });
}

function normalizeWhitespace(line: string): string {
  return line
    .replace(/[  \t]/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function normalize(raw: string): string {
  let s = raw.normalize("NFC");
  // Strip BOM and zero-width space/non-joiner. ZWJ (U+200D) is deliberately
  // spared: it is load-bearing inside emoji sequences.
  s = s.replace(/[﻿​‌]/g, "");
  s = s.replace(/\r\n|\r/g, "\n");

  // De-linkify BEFORE decoding entities: Slack escapes a literal "<" as "&lt;",
  // so decoding first would manufacture links out of ordinary text.
  s = delinkify(s);
  s = decodeEntities(s);

  s = emojiToShortcodes(s);
  s = normalizeAliases(s);

  return s.split("\n").map(normalizeWhitespace).join("\n");
}

export function normalizeLines(raw: string): {
  normalized: string[];
  original: string[];
} {
  const original = raw.replace(/\r\n|\r/g, "\n").split("\n");
  const normalized = normalize(raw).split("\n");
  return { normalized, original };
}

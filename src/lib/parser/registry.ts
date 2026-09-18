import type { GameDefinition } from "./types";
import { maptap } from "./games/maptap";
import { krillion, krillionInfinite } from "./games/krillion";
import { sizeItUp } from "./games/sizeItUp";
import { globle } from "./games/globle";
import { globleFreeform } from "./games/globleFreeform";
import { fermi } from "./games/fermi";

/** Adding a game is one file plus one entry here. */
export const GAME_REGISTRY: GameDefinition[] = [
  maptap,
  krillionInfinite,
  krillion,
  sizeItUp,
  globle,
  fermi,
  globleFreeform,
];

export const FIRST_PASS = GAME_REGISTRY.filter((d) => !d.secondPass);
export const SECOND_PASS = GAME_REGISTRY.filter((d) => d.secondPass);

import type { Expression } from '../../../art/portrait';
import type { ScriptApi } from '../../../game/script';
import type { CharId } from '../../characters';

/** Dialogue lines for `s.talk`: [speaker, text, expression?]. */
export type TalkLines = Array<[string, string, Expression?]>;

/** Pick the entry for the current story point: the last one whose chapter threshold is reached. */
export function byChapter<T>(s: ScriptApi, table: Array<[number, T]>): T {
  let pick = table[0][1];
  for (const [ch, v] of table) if (s.check(`chapter>=${ch}`)) pick = v;
  return pick;
}

/** An NPC's reaction to one playable character: a single line it says, or a short exchange (speaker 'hero' = you). */
export type HeroReaction = string | TalkLines;

/** What an NPC says to each playable character. Characters left out get the NPC's normal chatter. */
export type HeroReactions = Partial<Record<CharId, HeroReaction>>;

/**
 * LoG2's hub NPCs branch on the character you are playing (its scripts test CurChar / CurCharName). The first talk
 * as a given character, and every other talk after that, plays that character's reaction. The talks in between
 * fall through to the NPC's story-progress chatter, so both stay reachable. Returns true when the NPC reacted.
 */
export async function heroTalk(s: ScriptApi, npc: string, reactions: HeroReactions, expr: Expression = 'neutral'): Promise<boolean> {
  const r = reactions[s.hero];
  if (!r) return false;
  if (s.inc(`${npc}_as_${s.hero}`) % 2 === 0) return false;
  if (typeof r === 'string') await s.say(npc, r, expr);
  else await s.talk(r);
  return true;
}

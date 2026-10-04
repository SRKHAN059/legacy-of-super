/** Journal star tiers (LoG2): gold = main story, silver = important, bronze = optional. */
export type Star = 'gold' | 'silver' | 'bronze';

export interface QuestDef {
  id: string;
  title: string;
  star: Star;
  /** Hint text shown in the journal. */
  desc: string;
  /** World-map region the objective points to (the world-map star). */
  region?: string;
}

/** All journal entries. Chapter content registers its own. */
export const QUESTS: Record<string, QuestDef> = {};

/** Register journal entries. */
export function registerQuests(list: QuestDef[]): void {
  for (const q of list) {
    if (QUESTS[q.id]) throw new Error(`Duplicate quest id "${q.id}"`);
    QUESTS[q.id] = q;
  }
}

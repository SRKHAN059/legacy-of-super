import { registerQuests, type QuestDef } from '../quests';

/** The Test Arena's journal entry (gold, so the journal's star tiers can be tried on the dev maps). */
export const DEV_QUESTS: QuestDef[] = [
  { id: 'dev_q1', title: 'Beat the sparring robot in the Test Arena', star: 'gold', desc: 'Head east through the level 3 gate.' },
];

/** Register the dev quest (dev builds only; see `dev/index.ts`). */
export function registerDevQuests(): void {
  registerQuests(DEV_QUESTS);
}

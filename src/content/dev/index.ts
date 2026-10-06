import { registerDevQuests } from './quests';
import { registerDevSandbox } from './sandbox';

/** Register every piece of developer content: the test maps, their scripts, boss and spots, and the dev quest. */
export function registerDevContent(): void {
  registerDevSandbox();
  registerDevQuests();
}

// Developer content exists on the dev server and in tests only. A production build folds `import.meta.env.DEV` to
// false, drops this call, and with it every dev module: no test map, quest, boss or world-map spot ships to players.
if (import.meta.env.DEV) registerDevContent();

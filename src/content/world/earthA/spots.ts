import { registerSpots } from '../../world';

/** World-map landing spots for the Earth A regions (Guide §8). Chapters unlock them with `s.unlockRegion`. */
registerSpots([
  { id: 'spot_paozu', name: 'Mt. Paozu', world: 'earth', x: 96, y: 92, map: 'paozu_valley', tx: 30, ty: 9, icon: 'mountain' },
  { id: 'spot_satancity', name: 'Satan City', world: 'earth', x: 118, y: 150, map: 'satan_plaza', tx: 23, ty: 30, icon: 'city' },
  { id: 'spot_kame', name: 'Kame House', world: 'earth', x: 200, y: 172, map: 'kame_island', tx: 20, ty: 25, icon: 'island' },
  { id: 'spot_lookout', name: 'The Lookout', world: 'earth', x: 128, y: 62, map: 'korin_base', tx: 20, ty: 28, icon: 'tower' },
]);

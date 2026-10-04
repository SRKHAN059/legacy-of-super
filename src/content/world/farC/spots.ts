import { registerSpots } from '../../world';

/** World-map landing spots for Future Earth and space (CONTENT_GUIDE §8). Story chapters unlock them. */
registerSpots([
  { id: 'spot_future_city', name: 'Future West City', world: 'future', x: 150, y: 118, map: 'future_city', tx: 40, ty: 4, icon: 'ruins' },
  { id: 'spot_future_base', name: 'Resistance Hideout', world: 'future', x: 120, y: 140, map: 'future_hideout_out', tx: 17, ty: 21, icon: 'cave', color: '#e09040' },
  { id: 'spot_kingkai', name: 'King Kai\'s Planet', world: 'space', x: 70, y: 70, map: 'kingkai_planet', tx: 16, ty: 20, icon: 'planet', color: '#58c048' },
  { id: 'spot_beerus', name: 'Beerus\'s Planet', world: 'space', x: 128, y: 120, map: 'beerus_grounds', tx: 30, ty: 27, icon: 'planet', color: '#b070e0' },
  { id: 'spot_u10', name: 'Sacred World (U10)', world: 'space', x: 80, y: 186, map: 'u10_sacred', tx: 20, ty: 26, icon: 'planet', color: '#60d0b0' },
  { id: 'spot_zeno', name: 'Zeno\'s Palace', world: 'space', x: 188, y: 186, map: 'zeno_palace', tx: 20, ty: 26, icon: 'palace', color: '#f0d060' },
  { id: 'spot_space_earth', name: 'Earth', world: 'space', x: 128, y: 200, map: 'kingkai_planet', tx: 16, ty: 20, icon: 'planet', color: '#4890e0', toWorld: 'earth' },
]);

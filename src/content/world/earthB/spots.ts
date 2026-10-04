import { registerSpots } from '../../world';

/** World-map landing spots for West City, the Rocky Wasteland, Diablo Desert and the Snowy Highlands (Guide §8). */
registerSpots([
  { id: 'spot_westcity', name: 'West City', world: 'earth', x: 150, y: 118, map: 'wc_streets', tx: 2, ty: 20, icon: 'city' },
  { id: 'spot_wasteland', name: 'Rocky Wasteland', world: 'earth', x: 74, y: 128, map: 'waste_entry', tx: 3, ty: 15, icon: 'mountain' },
  { id: 'spot_desert', name: 'Diablo Desert', world: 'earth', x: 92, y: 192, map: 'desert_entry', tx: 4, ty: 15, icon: 'ruins' },
  { id: 'spot_snow', name: 'Snowy Highlands', world: 'earth', x: 150, y: 42, map: 'snow_entry', tx: 20, ty: 25, icon: 'mountain' },
]);

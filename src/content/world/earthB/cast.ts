import { registerCast } from '../../cast';

const SKIN = '#f8c890';
const SKIN_TAN = '#e8b078';
const SKIN_DARK = '#a86838';

/** Ambient townsfolk looks for West City, the wasteland, the desert and the highlands. */
registerCast({
  eb_ccStaff: { body: 'female', skin: SKIN, hair: 'bun', hairColor: '#c89050', top: '#f0f0f8', topStyle: 'suit', under: '#3868b0', sleeves: 'long', pants: '#3868b0', boots: '#202030', emblem: '#3868b0' },
  eb_ccGuard: { body: 'male', skin: SKIN_TAN, hair: 'cap', hairColor: '#303848', accent: '#3868b0', top: '#3868b0', topStyle: 'suit', under: '#f0f0f0', sleeves: 'long', belt: '#202020', pants: '#283868', boots: '#101010', face: 'shades' },
  eb_ccTech: { body: 'female', skin: SKIN, hair: 'ponytail', hairColor: '#503020', accent: '#40a0f0', top: '#f0f0f0', topStyle: 'coat', under: '#40a0f0', sleeves: 'long', pants: '#404858', boots: '#283040' },
  eb_chef: { body: 'big', skin: SKIN, hair: 'turban', hairColor: '#f8f8f8', accent: '#e8e8e8', top: '#f8f8f8', topStyle: 'coat', under: '#d03030', sleeves: 'short', pants: '#383840', boots: '#202020', face: 'mustache' },
  eb_clerk: { body: 'male', skin: SKIN, hair: 'spiky', hairColor: '#305080', top: '#f0c030', topStyle: 'vest', under: '#f0f0f0', sleeves: 'long', pants: '#303848', boots: '#202028' },
  eb_worker: { body: 'big', skin: SKIN_DARK, hair: 'helmet', hairColor: '#f0c020', top: '#f08020', topStyle: 'vest', under: '#506078', sleeves: 'short', pants: '#3a4a70', boots: '#5a3a20' },
  eb_kidGirl: { body: 'child', skin: SKIN, hair: 'braids', hairColor: '#e09040', top: '#f06898', topStyle: 'dress', sleeves: 'short', pants: '#f06898', boots: '#f8f8f8' },
  eb_suit: { body: 'male', skin: SKIN, hair: 'short', hairColor: '#282828', top: '#404858', topStyle: 'suit', under: '#f0f0f0', sleeves: 'long', pants: '#404858', boots: '#181818' },
  eb_mechanic: { body: 'male', skin: SKIN_TAN, hair: 'cap', hairColor: '#202020', accent: '#c03030', top: '#e07030', topStyle: 'shirt', sleeves: 'long', belt: '#303030', pants: '#e07030', boots: '#303030' },
  eb_gardener: { body: 'male', skin: SKIN_TAN, hair: 'hat', hairColor: '#e0c070', accent: '#40a040', top: '#58a048', topStyle: 'shirt', sleeves: 'long', pants: '#806040', boots: '#503018', face: 'beard' },
  eb_granny: { body: 'female', skin: SKIN, hair: 'bun', hairColor: '#d8d8e0', top: '#9070b0', topStyle: 'dress', sleeves: 'long', pants: '#9070b0', boots: '#504060', face: 'gentle' },
  eb_geologist: { body: 'female', skin: SKIN_TAN, hair: 'ponytail', hairColor: '#805030', accent: '#f0d040', top: '#c0a070', topStyle: 'vest', under: '#f0f0e0', sleeves: 'short', pants: '#706048', boots: '#503820' },
  eb_nomad: { body: 'male', skin: SKIN_DARK, hair: 'turban', hairColor: '#f0e8d0', accent: '#c04040', top: '#e8d8b0', topStyle: 'robe', under: '#a08050', sleeves: 'long', pants: '#a08050', boots: '#604020', face: 'beard' },
  eb_trader: { body: 'female', skin: SKIN_TAN, hair: 'long', hairColor: '#402818', top: '#40a0a0', topStyle: 'robe', under: '#e0c070', sleeves: 'long', pants: '#e0c070', boots: '#806040', earring: '#f0d040' },
  eb_climber: { body: 'male', skin: SKIN, hair: 'cap', hairColor: '#503020', accent: '#e04030', top: '#e04030', topStyle: 'coat', under: '#f0f0f0', sleeves: 'long', pants: '#303848', boots: '#604020', scarf: '#f0d040' },
  eb_ranger: { body: 'female', skin: SKIN, hair: 'bob', hairColor: '#202020', top: '#4a6a40', topStyle: 'coat', under: '#e0d0a0', sleeves: 'long', pants: '#4a5a40', boots: '#3a2a18', scarf: '#c04040' },
}, {
  eb_ccStaff: 'Receptionist', eb_ccGuard: 'Security Guard', eb_ccTech: 'Technician', eb_chef: 'Ramen Chef', eb_clerk: 'Clerk',
  eb_worker: 'Worker', eb_kidGirl: 'Girl', eb_suit: 'Salaryman', eb_mechanic: 'Mechanic', eb_gardener: 'Gardener', eb_granny: 'Granny',
  eb_geologist: 'Geologist', eb_nomad: 'Nomad', eb_trader: 'Trader', eb_climber: 'Climber', eb_ranger: 'Ranger',
});

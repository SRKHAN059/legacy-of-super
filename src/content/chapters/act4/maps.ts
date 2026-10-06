import { registerMaps } from '../../registry';

/**
 * Act 4 chapter-owned maps.
 *  - c09_flash_wastes : Trunks's flashback - the crater where Babidi's ship landed (Dabura fight).
 *  - c09_outskirts    : West City outskirts, Goku vs Goku Black in the present.
 *  - c09_mine         : the abandoned Capsule Corp mine (Hyper-Crystal fuel quest, Excavator mini-boss).
 *  - c10_babari       : Planet Babari (Gowasu's fruit side quest, Babarian Chief).
 *  - c10_lair         : Black's hideout in the future ruins (first trip: Vegeta vs Black / Rose, immortal Zamasu;
 *                       second trip: the truth, Goku vs Black).
 *  - c11_rift_sky     : the plaza under the sky rift (Rose boss, Mafuba seal, Fused Zamasu relay).
 */

registerMaps([
  // ------------------------------------------------------------------ Ch9 flashback
  {
    id: 'c09_flash_wastes', name: 'Memory: Babidi\'s Landing Site', music: 'future', hostile: true, region: 'Future Earth',
    tint: 'rgba(150,110,50,0.30)',
    legend: { '#': 'cliff', '.': 'wasteland', ',': 'dirt', 'k': 'rock' },
    grid: [
      '############################', // 0
      '###......................###', // 1
      '##.....,,,,,....,,,,,.....##', // 2
      '#.....,,,,,,,..,,,,,,,.....#', // 3
      '#..kk..,,,,,....,,,,,......#', // 4
      '#..kk.................kk...#', // 5
      '#.........,,,,,,,,....kk...#', // 6
      '#........,,,,,,,,,,........#', // 7
      '#.......,,,,,,,,,,,,.......#', // 8
      '#.......,,,,,,,,,,,,.......#', // 9
      '#...,...,,,,,,,,,,,,...,...#', // 10
      '#..,,,...,,,,,,,,,,...,,,..#', // 11
      '#.,,,,,...,,,,,,,,...,,,,,.#', // 12
      '#..,,,....kk.....kk...,,,..#', // 13
      '##..,.....kk.....kk....,..##', // 14
      '##........................##', // 15
      '####....................####', // 16
      '############################', // 17
    ],
    props: [
      ['spaceship', 10.5, 0.6], ['crater', 2, 9], ['crater', 20, 9.5], ['deadTree', 23, 1.4], ['deadTree', 2, 1.6],
      ['rubble', 7, 15], ['rubble', 19, 15], ['boulder', 22.5, 12.5], ['boulder', 2.5, 12.6], ['smallRock', 9, 5], ['smallRock', 18, 6],
      ['brokenPillar', 5, 2], ['brokenPillar', 21, 2.4],
    ],
  },

  // ------------------------------------------------------------------ Ch9 outskirts (Goku vs Black)
  {
    id: 'c09_outskirts', name: 'West City Outskirts', music: 'tense', hostile: true, region: 'West City',
    legend: { 'g': 'grass', ',': 'dirt', '=': 'asphalt', '.': 'wasteland', 'k': 'rock', '#': 'cliff' },
    grid: [
      'gggggggggggggggggggggggggggggggg', // 0
      'gggggggggggggggggggggggggggggggg', // 1
      'gggggggggggggggggggggggggggggggg', // 2
      ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 3
      '================================', // 4
      '================================', // 5
      ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 6
      '#........,...........,.........#', // 7
      '#kk....,,,,,.......,,,,,....kkk#', // 8
      '#kk......,...........,......kkk#', // 9
      '#...........,,,,,,,............#', // 10
      '#.........,,,,,,,,,,,..........#', // 11
      '#........,,,,,,,,,,,,,.........#', // 12
      '#.........,,,,,,,,,,,..........#', // 13
      '#kk.........,,,,,,,........kkk.#', // 14
      '#kk........................kkk.#', // 15
      '##............................##', // 16
      '###...........................##', // 17
      '####........................####', // 18
      '################################', // 19
    ],
    props: [
      // West City's skyline walls off the north edge.
      ['building', 0, -0.4], ['building', 2.9, -0.2], ['tower', 5.8, -0.6], ['building', 7.7, -0.3], ['building', 10.6, -0.5],
      ['building', 13.5, -0.2], ['tower', 16.4, -0.6], ['building', 18.3, -0.4], ['building', 21.2, -0.2], ['building', 24.1, -0.5],
      ['tower', 27, -0.6], ['building', 28.9, -0.3],
      // Abandoned cars on the highway (everyone fled when the sky went dark).
      ['car', 4, 4.1], ['car', 12.5, 4.8], ['car', 23, 4.2], ['lamp', 9, 6.2], ['lamp', 20, 6.2],
      // Rocky plain.
      ['boulder', 3.5, 15.6], ['boulder', 25.5, 16], ['rock', 6, 9.5], ['rock', 24, 10], ['smallRock', 11, 16], ['smallRock', 19, 8.5],
      ['deadTree', 2, 10.4], ['deadTree', 28.3, 11.4], ['bush', 8, 17], ['bush', 21, 17.2], ['grassTuft', 13, 17], ['grassTuft', 17, 16],
      ['crater', 13, 10.6],
    ],
    objects: [
      { type: 'breakable', x: 6, y: 13, size: 1 }, { type: 'breakable', x: 26, y: 12, size: 2 }, { type: 'breakable', x: 16, y: 17, size: 1 },
    ],
  },

  // ------------------------------------------------------------------ Ch9 abandoned mine
  {
    id: 'c09_mine', name: 'Old Capsule Corp Mine', music: 'cave', hostile: true, region: 'Capsule Corp Mine',
    tint: 'rgba(10,20,40,0.28)',
    legend: { '#': 'cliff', '.': 'rock', ',': 'dirt', 'm': 'metal', '~': 'water', 'L': 'lava' },
    grid: [
      '########################################', // 0
      '##########################LL..........##', // 1
      '##...#....#....##########.LL...........#', // 2
      '##...#.........##########......mmm.....#', // 3
      '##...#....#....##########L.....mmm.....#', // 4
      '###..#....###############L.....mmm.....#', // 5
      '##............###########............LL#', // 6
      '##.....,.......############..........LL#', // 7
      '##......,....,.##############,,,########', // 8
      '##.....,....,..##############,,,########', // 9
      '##.,,....#.....##############,,,########', // 10
      '###...........###############,,,########', // 11
      '#####,,,##########.............#########', // 12
      '#####,,,#########..........,,,..##....##', // 13
      '#####,,,########...........,,,..#......#', // 14
      '####,,,,########................#......#', // 15
      '####,,,,########......~~~~~.....,......#', // 16
      '#####,,,########.....~~~~~~~....,......#', // 17
      '#####,,,,#######....~~~...~~~...,......#', // 18
      '#####,,,########....~~~...~~~...#.,,,..#', // 19
      '#####,,,########....~~~...~~~...#.,,,..#', // 20
      '###.........####....~~~~~~~~~...#......#', // 21
      '##............,,.....~~~~~~~....##....##', // 22
      '##.mmmmm.....,,,......~~~~~.....########', // 23
      '##.mmmmm.....,,,.,,,,,,.........########', // 24
      '##.mmmmm.....,,,.,,,,,,.........########', // 25
      '##.mmmmm,,,,..##................########', // 26
      '###..........#####............##########', // 27
      '########################################', // 28
      '########################################', // 29
    ],
    props: [
      // Entrance: the old loading platform.
      ['c09_minecart', 9, 24.4], ['crate', 3, 21.2], ['crate', 4, 21.2], ['barrel', 11.4, 21.4], ['lamp', 8, 21.2], ['lamp', 2.2, 25.4],
      // West gallery and the crystal alcove.
      { kind: 'c09_crystalVein', x: 3, y: 1.6, id: 'c09_vein1', hideFlag: 'c09_crys1' },
      ['boulder', 11, 8.6], ['rock', 2.4, 8.6], ['smallRock', 7, 3], ['lamp', 6.2, 6.4], ['crate', 12.4, 2.2],
      // Central cavern: the underground lake and its islet.
      { kind: 'c09_crystalVein', x: 24, y: 17.1, id: 'c09_vein2', hideFlag: 'c09_crys2' },
      ['rock', 17, 13.2], ['boulder', 28.5, 24.5], ['smallRock', 30, 17], ['c09_minecart', 18, 24.8], ['lamp', 16.2, 21.2], ['lamp', 30.2, 21.2],
      // Deep shaft: the Excavator's berth and the last vein.
      { kind: 'c09_crystalVein', x: 35.5, y: 0.9, id: 'c09_vein3', hideFlag: 'c09_crys3' },
      ['crate', 34.2, 6.4], ['barrel', 29, 1.4], ['rubble', 27.5, 5.6], ['lamp', 30.2, 2], ['lamp', 34.6, 2],
      // Side chamber.
      ['crate', 34.2, 13.6], ['crate', 35.2, 13.6], ['barrel', 37.4, 15], ['rubble', 34, 21.4],
    ],
    enemies: [
      { type: 'c09_crystalBat', x: 5, y: 8 }, { type: 'c09_crystalBat', x: 12, y: 7 }, { type: 'c09_rockCrawler', x: 6, y: 15 },
      { type: 'c09_mineDrone', x: 8, y: 3 }, { type: 'c09_mineDrone', x: 19, y: 14 }, { type: 'c09_haywireMech', x: 22, y: 25 },
      { type: 'c09_rockCrawler', x: 29, y: 15 }, { type: 'c09_crystalBat', x: 26, y: 13 }, { type: 'c09_haywireMech', x: 18, y: 20 },
      { type: 'c09_mineDrone', x: 30, y: 23 }, { type: 'c09_haywireMech', x: 36, y: 17 }, { type: 'c09_crystalBat', x: 30, y: 10 },
    ],
    objects: [
      { type: 'save', x: 4, y: 23 },
      { type: 'worldSign', x: 7, y: 23 },
      { type: 'save', x: 31, y: 11 },
      { type: 'sign', x: 10, y: 22, text: 'CAPSULE CORP MINING SITE 7 - CLOSED. Hyper-Crystal extraction suspended. Do NOT reactivate the Excavator. (Signed: Dr. Brief, who is very sorry about the Excavator.)' },
      { type: 'sign', x: 29, y: 12, text: 'DEEP SHAFT - Excavator X-7 berth. Authorized personnel only. Seriously.' },
      { type: 'breakable', x: 3, y: 5, size: 2 }, { type: 'breakable', x: 4, y: 5, size: 2 },
      { type: 'breakable', x: 12, y: 10, size: 3 }, { type: 'breakable', x: 21, y: 13, size: 1 }, { type: 'breakable', x: 28, y: 25, size: 1, look: 'jar' },
      { type: 'breakable', x: 36, y: 14, size: 1, look: 'jar', item: 'pow1', id: 'c09_jar1' }, { type: 'breakable', x: 9, y: 26, size: 1, look: 'crate' },
      { type: 'breakable', x: 18, y: 26, size: 2 },
      { type: 'chest', x: 13, y: 3, id: 'c09_chest_nook', item: 'end3' },
      { type: 'chest', x: 37, y: 20, id: 'c09_chest_side', item: 'str3' },
      { type: 'flight', x: 19, y: 19, to: 'c09_mine', tx: 24, ty: 20, label: 'Hop to the islet' },
      { type: 'flight', x: 23, y: 19, to: 'c09_mine', tx: 18, ty: 19, label: 'Back to shore' },
    ],
    barriers: [
      { id: 'c09_g_goku', x: 10, y: 3, w: 1, h: 1, level: 34, character: 'goku' },
      { id: 'c09_g_trunks', x: 32, y: 16, w: 1, h: 3, level: 32, character: 'trunks' },
    ],
    triggers: [
      { id: 'c09_t_crys1', x: 2, y: 2, w: 3, h: 2, script: 'c09_crystal1', onAction: true, hideIf: 'c09_crys1' },
      { id: 'c09_t_crys2', x: 23, y: 18, w: 3, h: 2, script: 'c09_crystal2', onAction: true, hideIf: 'c09_crys2' },
      { id: 'c09_t_crys3', x: 35, y: 2, w: 3, h: 2, script: 'c09_crystal3', onAction: true, hideIf: 'c09_crys3' },
      { id: 'c09_t_excavator', x: 29, y: 7, w: 3, h: 1, script: 'c09_excavator_fight', hideIf: 'c09_exStarted' },
    ],
    onEnter: 'c09_mine_enter',
  },

  // ------------------------------------------------------------------ Ch10 Planet Babari
  {
    id: 'c10_babari', name: 'Planet Babari', music: 'alien', hostile: true, region: 'Planet Babari', backdrop: '#0c1830',
    legend: { '#': 'cliff', '.': 'alienGrass', ',': 'darkGrass', 'd': 'dirt', '=': 'path', '~': 'water', 's': 'sand' },
    grid: [
      '########################################', // 0
      '###.......###....~~~.##..............###', // 1
      '##,,,,,,,,,,,,,..~~~...###..........####', // 2
      '#.,,,,,,,,,,,,,..~~~...#..,,,,,,,,,....#', // 3
      '#.,,,,,,,,,,,.,.~~~~...#..,,,,,,,,,....#', // 4
      '#.,,,,,.,,,,,,..~~~~...#..,,,,,,,,,....#', // 5
      '#.,,,.....,,,,,..~~~...#..,,,,,,,,,....#', // 6
      '#.,,.......,,,,..~~~...#..,,,,,,,,,....#', // 7
      '#.,,,.....,,,,,..~~~~..#..,,,,,,,,,....#', // 8
      '#.,,,,,.,,,,,,,..~~~~..#...............#', // 9
      '#.,,,,,,,,,,,,,..~~~...######==#########', // 10
      '#.,,,,,,,,,.,,,..~~~.........==........#', // 11
      '#.,,..,,,,...,,.sssss........==........#', // 12
      '#.,,,,==========sssss====....==........#', // 13
      '#.,,,,==========sssss====....==........#', // 14
      '#.,,,,==,,,.,,,..~~~...dddddddddddd....#', // 15
      '#.,,,,==,,,,,,,..~~~..dddddddddddddd...#', // 16
      '#.....==.........~~~..dddddddddddddd...#', // 17
      '#.....==.........~~~..dddddddddddddd...#', // 18
      '#..ddd==dd.......~~~..dddddddddddddd...#', // 19
      '#.ddddddddd.....~~~~..dddddddddddddd...#', // 20
      '#.ddddddddd.....~~~~..dddddddddddddd...#', // 21
      '#.ddddddddd......~~~..dddddddddddddd...#', // 22
      '#.ddddddddd......~~~~.dddddddddddddd~..#', // 23
      '#.ddddddddd......~~~...dddddddddddd~~~.#', // 24
      '##.ddddddd.......~~~................~.##', // 25
      '##...............~~~.................###', // 26
      '########################################', // 27
    ],
    props: [
      // Landing clearing: the Kai stone Gowasu uses to send visitors here.
      ['shrine', 2.6, 18.6], ['flowers', 6, 19], ['flowers', 9, 24.6], ['grassTuft', 2, 24],
      // Jungle (west).
      ['alienTree', 3, 2.4], ['alienTree', 9, 1.6], ['alienTree', 12.5, 4], ['alienTree', 2, 8.6], ['alienTree', 13, 9.4],
      ['alienTree', 3.6, 14.4], ['alienTree', 10, 15.6], ['alienTree', 13.2, 18.6], ['bush', 5.4, 11], ['bush', 10, 11.4], ['grassTuft', 4, 6], ['grassTuft', 11, 3],
      // East bank.
      ['alienTree', 20.6, 2.6], ['alienTree', 20.4, 6.8], ['alienTree', 20.6, 19], ['alienTree', 36.4, 11.2], ['alienTree', 36.6, 15.4], ['bush', 21, 24.6],
      // Babarian village: huts, totems, the fire pit.
      ['hut', 22.4, 15.2], ['hut', 32.6, 15.2], ['hut', 22.4, 21.6], ['hut', 32.6, 21.6], ['campfire', 28.5, 19.6],
      ['c10_totem', 26, 15.4], ['c10_totem', 31, 15.4], ['tent', 26.4, 22.4], ['barrel', 25.4, 19.4], ['jar', 31.6, 19.6],
      // Plateau: the sacred tree.
      ['c10_fruitTree', 29, 2.6], ['flowers', 26, 4], ['flowers', 33, 4.4], ['flowers', 27, 8], ['flowers', 33, 8], ['rock', 24.4, 6.6], ['rock', 36, 7.4],
    ],
    npcs: [
      { id: 'c10_slain', sprite: 'babarian', x: 8, y: 7, dir: 'left', talk: 'c10_slain_talk', name: 'Fallen Babarian', showIf: 'chapter>=10', hideIf: 'chapter>=12' },
      { id: 'c10_chief', sprite: 'c10_babarianChief', x: 30, y: 8, dir: 'down', talk: 'c10_chief_talk', name: 'Babarian Chief', hideIf: 'c10_chiefBeaten' },
    ],
    enemies: [
      { type: 'c10_babarian', x: 5, y: 10 }, { type: 'c10_babarian', x: 12, y: 12 }, { type: 'c10_babariBeast', x: 9, y: 4 },
      { type: 'c10_babarianSlinger', x: 21, y: 5 }, { type: 'c10_babarianSlinger', x: 21, y: 22 },
      { type: 'c10_babarian', x: 25, y: 18 }, { type: 'c10_babarian', x: 34, y: 19 }, { type: 'c10_babarianSlinger', x: 28, y: 24 },
      { type: 'c10_babariBeast', x: 37, y: 14 }, { type: 'c10_babariBeast', x: 12, y: 21 },
    ],
    objects: [
      { type: 'save', x: 4, y: 23 },
      { type: 'worldSign', x: 8, y: 23 },
      { type: 'sign', x: 6, y: 18, text: 'Carved into the Kai stone, in Supreme Kai script: "Watch. Wait. Hope." Someone has scratched a line through "Hope."' },
      { type: 'chest', x: 36, y: 4, id: 'c10_chest_plateau', item: 'end3' },
      { type: 'breakable', x: 12, y: 6, size: 2 }, { type: 'breakable', x: 14, y: 17, size: 1 }, { type: 'breakable', x: 21, y: 9, size: 3, item: 'pow1', id: 'c10_brk1' },
      { type: 'breakable', x: 37, y: 8, size: 1, look: 'jar' }, { type: 'breakable', x: 34, y: 24, size: 1 }, { type: 'breakable', x: 2, y: 11, size: 2 },
    ],
    triggers: [
      { id: 'c10_t_kaistone', x: 2, y: 20, w: 3, h: 2, script: 'c10_kaistone', onAction: true },
      { id: 'c10_t_tree', x: 29, y: 6, w: 3, h: 2, script: 'c10_fruit_tree', onAction: true },
    ],
    onEnter: 'c10_babari_enter',
  },

  // ------------------------------------------------------------------ Ch10 Black's hideout
  {
    id: 'c10_lair', name: 'Black\'s Hideout', music: 'future', hostile: true, region: 'Future Earth',
    tint: 'rgba(60,20,50,0.16)',
    legend: { '#': 'cliff', 'M': 'marble', 'a': 'asphalt', 'r': 'ruins', 'k': 'rock', 'w': 'wasteland' },
    grid: [
      '##################################', // 0
      '#########MMMMMMMMMMMMMMMM#########', // 1
      '########MMMMMMMMMMMMMMMMMM########', // 2
      '########MMMMMMMMMMMMMMMMMM########', // 3
      '########MwMMMMMMMMMMMMMMwM########', // 4
      '########MMMMMMMMMMMMMMMMMM########', // 5
      '########MMMMMMMMMMMMMMMMMM########', // 6
      '#########MMMMMaaaaaaMMMMM#########', // 7
      '##############aaaaaa##############', // 8
      '##kkkkkk######aakaaa##############', // 9
      '##kwwwwk#####raaaaaar#############', // 10
      '##kwwwwk#####raaaaaarrrrkrrrrrr###', // 11
      '##kwwwwk#####raaaaaaraaaaarrrrk###', // 12
      '###rrwwrrrkrrraaaaaaraaaaarrrrr###', // 13
      '###rrrrraaaaaraaaaaarrrrrrrrrrr###', // 14
      '###rkrrraaaaaraaaaaar#####kkkkkk##', // 15
      '###rrrrrrrrrrraaaaaar#####kwwwwk##', // 16
      '#############raaakaar#####kwwwwk##', // 17
      '#############raaaaaar#####kwwwwk##', // 18
      '###########raaaaaaaaaar###kkkkkk##', // 19
      '###########aaaaaaaaaaaa###########', // 20
      '###########aaaaaaaaaaaa###########', // 21
      '###########rrrrrrrrrrrr###########', // 22
      '##################################', // 23
    ],
    props: [
      // The courtyard: a gods' tea garden amid the ruins.
      ['table', 15.5, 2.6], ['chair', 14.6, 2.7], ['chair', 17.6, 2.7], ['plant', 9.2, 1.6], ['plant', 23.6, 1.6],
      ['pillar', 10, 4.2], ['pillar', 22.5, 4.2], ['brokenPillar', 12, 5.4], ['brokenPillar', 20.5, 5.4], ['flowers', 13, 1.6], ['flowers', 20, 1.8],
      ['ruinedBuilding', 0.5, 2], ['ruinedBuilding', 26.5, 1.4], ['ruinedBuilding', 3.5, 5.6], ['ruinedBuilding', 26, 6.2],
      // The avenue.
      ['ruinedBuilding', 8.6, 15.4], ['ruinedBuilding', 21, 15.6], ['ruinedBuilding', 21.6, 6.8], ['ruinedBuilding', 9, 6.6],
      ['car', 17.6, 12.4], ['car', 14, 17.6], ['rubble', 18.4, 9.4], ['crater', 15, 13.4], ['lamp', 13.1, 11], ['lamp', 20.1, 14.4],
      // Pharmacy (west alley) and the hound den (east).
      ['counter', 3, 9.2], ['crate', 6.2, 10.4], ['jar', 2.4, 12], ['rubble', 9, 15.4], ['deadTree', 3, 13.4],
      ['deadTree', 30, 10.4], ['rubble', 27, 18.4], ['crate', 30.4, 16.2], ['smallRock', 24, 13],
      // South plaza.
      ['c11_barricade', 11.2, 19.2], ['deadTree', 21.4, 19], ['smallRock', 12, 21],
    ],
    npcs: [
      { id: 'c10_runner', sprite: 'resistance', x: 12, y: 20, dir: 'right', talk: 'c10_runner_talk', name: 'Runner Kai', showIf: 'chapter>=10', hideIf: 'c10_medsDone&chapter>=12' },
    ],
    enemies: [
      { type: 'c10_mutantHound', x: 16, y: 15 }, { type: 'c10_mutantHound', x: 5, y: 14 }, { type: 'c10_mutantHound', x: 24, y: 12 },
      { type: 'c10_scrapMech', x: 17, y: 11, hideIf: 'chapter>=12' }, { type: 'c10_scrapMech', x: 28, y: 17 }, { type: 'c10_mutantHound', x: 10, y: 14 },
    ],
    objects: [
      { type: 'save', x: 13, y: 21 },
      { type: 'worldSign', x: 20, y: 21 },
      { type: 'save', x: 18, y: 9 },
      { type: 'sign', x: 19, y: 19, text: 'A sign in elegant brushwork: "This garden belongs to the gods. Mortals, kindly perish elsewhere."' },
      { type: 'chest', x: 29, y: 18, id: 'c10_chest_den', item: 'end3' },
      { type: 'breakable', x: 8, y: 13, size: 2 }, { type: 'breakable', x: 25, y: 14, size: 1 }, { type: 'breakable', x: 19, y: 17, size: 1, look: 'crate' },
      { type: 'breakable', x: 4, y: 16, size: 3, item: 'str1', id: 'c10_brk_lair' },
    ],
    // The hound den's mouth: a Trunks gate. Goku (forced in Chapter 10) finds it shut; Trunks (forced in Chapter 11)
    // can come back on the third trip, while the future is still reachable, and loot the den.
    barriers: [{ id: 'c10_g_trunks', x: 26, y: 15, w: 6, h: 1, level: 38, character: 'trunks' }],
    triggers: [
      { id: 'c10_t_pharmacy', x: 2, y: 10, w: 4, h: 2, script: 'c10_pharmacy', onAction: true, showIf: 'quest:c10_q_medicine' },
      { id: 'c10_t_showdown', x: 14, y: 7, w: 6, h: 1, script: 'c10_showdown', showIf: 'quest:c10_q_lair', hideIf: 'c10_showdownStarted' },
    ],
    onEnter: 'c10_lair_enter',
  },

  // ------------------------------------------------------------------ Ch11 sky rift plaza
  {
    id: 'c11_rift_sky', name: 'Plaza Under the Rift', music: 'black', hostile: true, region: 'Future Earth',
    tint: 'rgba(110,30,90,0.22)',
    legend: { '#': 'cliff', 'r': 'ruins', 'a': 'asphalt', 'M': 'marble', 'w': 'wasteland' },
    grid: [
      '##############################', // 0
      '##############################', // 1
      '##############################', // 2
      '##rrr##rrrrrrrrrrrrrrr##rrrr##', // 3
      '##rrrrrrrrrrrrrrrrrrrrrrrrrr##', // 4
      '#rrrraaaaaaaaaaaaaaaaaaaarrrr#', // 5
      '#rrrraaaaaaaaaaaaaaaaaaaarrrr#', // 6
      '#rrrraaaaaaMMMMMMMMaaaaaarrrr#', // 7
      '#rrwraaaaaMMMMMMMMMMaaaaarrrr#', // 8
      '#rrwwaaaaMMMMMMMMMMMMaaaarrrr#', // 9
      '#rrrraaaaMMMMMMMMMMMMaaaarrrr#', // 10
      '#rrrraaaaMMMMMMMMMMMMaaaarrrr#', // 11
      '#rrrraaaaMMMMMMMMMMMMaaaarrrr#', // 12
      '#rrrraaaaaMMMMMMMMMMaaaaawwrr#', // 13
      '#rrrraaaaaaMMMMMMMMaaaaaarwrr#', // 14
      '#rrrraaaaaaaaaaaaaaaaaaaarrrr#', // 15
      '#rrrraaaaaaaaaaaaaaaaaaaarrrr#', // 16
      '#rrrrrrrrrrraaaaaarrrrrrrrrrr#', // 17
      '##rrrrrrwwrraaaaaarrrwrrrrrr##', // 18
      '###rrrrrrrrraaaaaarrrrwrrrr###', // 19
      '###rrrrrrrraaaaaaaarrrrrrrr###', // 20
      '##############################', // 21
    ],
    props: [
      // The skyline of what used to be downtown, and the tear in the sky above it.
      ['ruinedBuilding', 0, 0.9], ['ruinedBuilding', 3, 1.3], ['ruinedBuilding', 6.4, 0.7], ['ruinedBuilding', 19.6, 0.7],
      ['ruinedBuilding', 23, 1.2], ['ruinedBuilding', 26.2, 0.9], ['c11_riftTear', 10.5, 1.6], ['rubble', 10, 4.2], ['rubble', 17, 4.4],
      // Plaza ruins.
      ['brokenPillar', 6, 4.6], ['brokenPillar', 23, 4.6], ['pillar', 2.2, 9.4], ['pillar', 26.6, 9.4], ['rubble', 2, 15.4], ['rubble', 25.6, 16],
      ['crater', 12.5, 9.2], ['lamp', 9.2, 16.2], ['lamp', 19.6, 16.2], ['deadTree', 1.4, 5.2], ['deadTree', 26.4, 12.4],
      // The Resistance's last barricades.
      ['c11_barricade', 6, 16.6], ['c11_barricade', 19.6, 16.8], ['crate', 4.4, 18.2], ['barrel', 24, 18.4],
    ],
    enemies: [
      { type: 'c11_blackClone', x: 8, y: 14, showIf: 'chapter==11', hideIf: 'c11_roseBeaten' },
      { type: 'c11_blackClone', x: 21, y: 14, showIf: 'chapter==11', hideIf: 'c11_roseBeaten' },
      { type: 'c11_roseClone', x: 6, y: 8, showIf: 'chapter==11', hideIf: 'c11_roseBeaten' },
      { type: 'c11_roseClone', x: 23, y: 8, showIf: 'chapter==11', hideIf: 'c11_roseBeaten' },
    ],
    objects: [
      { type: 'save', x: 13, y: 19 },
      { type: 'breakable', x: 3, y: 12, size: 2 }, { type: 'breakable', x: 26, y: 6, size: 1, look: 'crate' }, { type: 'breakable', x: 25, y: 19, size: 1, look: 'jar' },
      { type: 'breakable', x: 4, y: 6, size: 1 },
    ],
    warps: [{ x: 11, y: 20, w: 8, h: 1, to: 'future_city', tx: 22, ty: 27, dir: 'down', hideIf: 'c11_finaleLock' }],
    triggers: [
      { id: 'c11_t_showdown', x: 5, y: 13, w: 20, h: 1, script: 'c11_showdown', showIf: 'quest:c11_q_rift', hideIf: 'c11_finaleLock' },
    ],
    onEnter: 'c11_rift_enter',
  },
]);

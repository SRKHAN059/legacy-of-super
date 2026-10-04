import { registerMaps } from '../../registry';
import { GridPainter } from './grid';

/** Post-game location: the ZTV press room behind the red gate (Mr. Satan's alternate ending). */

const ztv = new GridPainter(20, 13, 'c');
ztv.rect('R', 0, 0, 20, 1).rect('#', 0, 1, 20, 2).rect('#', 0, 0, 1, 13).rect('#', 19, 0, 1, 13).rect('#', 0, 12, 20, 1);
ztv.rect('c', 9, 12, 2, 1);
ztv.rect('f', 5, 3, 10, 3);

registerMaps([
  {
    id: 'post_ztv_studio', name: 'ZTV Studio', music: 'town', region: 'Satan City', indoor: true,
    legend: { R: 'roof', '#': 'wall', c: 'carpet', f: 'floor' },
    grid: ztv.rows(),
    props: [
      ['post_podium', 9, 3.2], ['tv', 2, 2.6], ['tv', 16, 2.6], ['lamp', 4.4, 3], ['lamp', 15, 3],
      ['c12_filmCamera', 2, 7], ['c12_filmCamera', 16, 7], ['plant', 1.2, 10], ['plant', 17.6, 10],
      ['chair', 6, 7.2], ['chair', 8, 7.2], ['chair', 12, 7.2], ['chair', 14, 7.2],
      ['chair', 5, 9.4], ['chair', 7, 9.4], ['chair', 13, 9.4], ['chair', 15, 9.4], ['rug', 8, 9],
    ],
    warps: [{ x: 9, y: 12, w: 2, h: 1, to: 'satan_plaza', tx: 8, ty: 12, dir: 'down', door: true }],
    objects: [{ type: 'sign', x: 3, y: 4, text: 'ZTV PRESS ROOM. Tonight: "The Champion Speaks!" (Every night: "The Champion Speaks!")' }],
  },
]);

/** Native GBA screen width in pixels. */
export const SCREEN_W = 240;
/** Native GBA screen height in pixels. */
export const SCREEN_H = 160;
/** World tile size in pixels (metatile, 2x2 hardware tiles). */
export const TILE = 16;
/** Simulation rate. The GBA runs at ~59.73 Hz; 60 is indistinguishable and keeps maths clean. */
export const FPS = 60;
/** Fixed timestep in seconds. */
export const DT = 1 / FPS;

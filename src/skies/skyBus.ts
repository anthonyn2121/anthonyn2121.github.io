import { createBus } from "../lib/bus";

/** The sky chart streams the RA and Dec under the pointer (or the crosshair) to the top bar. */
export const skyCursorBus = createBus<[ra: number, dec: number]>();

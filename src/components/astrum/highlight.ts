import { createBus } from "../../lib/bus";
import type { ArchId } from "../../data/astrum";

/** A project card's "Uses" chips light up those parts of the architecture diagram. */
export const archHighlight = createBus<[ids: ArchId[] | null]>();

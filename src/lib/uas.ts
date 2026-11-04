import type { UasGroup } from "../data/profile";

/** U.S. DoD UAS group definitions. */
export interface GroupSpec {
  group: UasGroup;
  weight: string;
  altitude: string;
  speed: string;
}

export const GROUPS: Record<UasGroup, GroupSpec> = {
  1: { group: 1, weight: "Up to 20 lb", altitude: "Below 1,200 ft AGL", speed: "Under 100 kt" },
  2: { group: 2, weight: "21 to 55 lb", altitude: "Below 3,500 ft AGL", speed: "Under 250 kt" },
  3: { group: 3, weight: "Under 1,320 lb", altitude: "Below 18,000 ft MSL", speed: "Under 250 kt" },
  4: { group: 4, weight: "Over 1,320 lb", altitude: "Below 18,000 ft MSL", speed: "Any airspeed" },
  5: { group: 5, weight: "Over 1,320 lb", altitude: "Above 18,000 ft MSL", speed: "Any airspeed" },
};

export const groupRange = (groups: UasGroup[]): string => {
  const sorted = [...new Set(groups)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Group ${sorted[0]}`;
  if (sorted.length === 2) return `Groups ${sorted[0]} and ${sorted[1]}`;
  const contiguous = sorted.every((g, i) => i === 0 || g === sorted[i - 1] + 1);
  if (contiguous) return `Groups ${sorted[0]} to ${sorted[sorted.length - 1]}`;
  return `Groups ${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
};

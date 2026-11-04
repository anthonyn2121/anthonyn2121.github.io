import type { MouseEvent } from "react";

const BASE = import.meta.env.BASE_URL;

export const HOME_HREF = BASE;
export const SKIES_HREF = `${BASE}skies/`;

const PITCH_KEY = "skies-pitch-up";

/**
 * Click handler for links to the sky page. Marks this tab so the sky page plays the
 * pitch-up transition; shared links, reloads, and new tabs open straight on the sky.
 */
export function onSkiesLinkClick(e: MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  markPitchUp();
}

export function markPitchUp() {
  try {
    sessionStorage.setItem(PITCH_KEY, "1");
  } catch {
    /* storage blocked: the sky page opens without the transition */
  }
}

/** Reads and clears the flag. Call once, at startup. */
export function takePitchUp(): boolean {
  try {
    const set = sessionStorage.getItem(PITCH_KEY) === "1";
    sessionStorage.removeItem(PITCH_KEY);
    return set;
  } catch {
    return false;
  }
}

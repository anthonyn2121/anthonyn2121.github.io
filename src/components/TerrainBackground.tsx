import { useMemo, type CSSProperties } from "react";
import { contourTile } from "../lib/topo";

const TILE = 720;

/** Slowly drifting topographic contours behind the page, like a moving map under the aircraft. */
export function TerrainBackground() {
  const tile = useMemo(() => contourTile(TILE, 1907), []);
  return (
    <div className="terrain" aria-hidden="true">
      <div className="terrain__layer" style={{ "--tile": `url("${tile}")`, "--tile-size": `${TILE}px` } as CSSProperties} />
    </div>
  );
}

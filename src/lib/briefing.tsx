import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const KEY = "briefing-dismissed";

interface BriefingCtx {
  open: boolean;
  show: () => void;
  dismiss: () => void;
}

const Ctx = createContext<BriefingCtx | null>(null);

/** Whether the "what is this layout" note is showing. Dismissal is remembered across visits. */
export function BriefingProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  });

  const show = useCallback(() => {
    setOpen(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage blocked: the note returns on the next visit */
    }
  }, []);

  return <Ctx.Provider value={{ open, show, dismiss }}>{children}</Ctx.Provider>;
}

export function useBriefing() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBriefing must be used inside BriefingProvider");
  return v;
}

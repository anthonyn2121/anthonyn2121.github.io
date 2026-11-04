import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { profile } from "../../data/profile";
import { scrollToId } from "../../lib/hooks";
import { markPitchUp, SKIES_HREF } from "../../lib/pages";
import { useTheme } from "../../lib/theme";
import { GROUPS } from "../../lib/uas";
import { SECTIONS } from "../StatusBar";
import { Panel } from "./Panel";

type Kind = "in" | "out" | "err" | "sys";
interface Line {
  id: number;
  kind: Kind;
  body: ReactNode;
}
interface Command {
  name: string;
  args?: string;
  desc: string;
  run: (args: string[]) => ReactNode;
}

interface Props {
  onOpenProject: (index: number) => void;
  onReplayFlight: () => void;
}

/** Shown as buttons, so visitors who don't want to type can still use the console. */
const SUGGESTED = ["whoami", "missions", "log", "platforms", "contact", "takeoff", "lookup"];

const sectionList = SECTIONS.map((s) => s.id).join(", ").replace(/, ([^,]*)$/, ", or $1");

export function ConsolePanel({ onOpenProject, onReplayFlight }: Props) {
  const { theme, setTheme } = useTheme();
  const nextId = useRef(2);
  const [lines, setLines] = useState<Line[]>(() => [
    { id: 0, kind: "sys", body: `Link established with ${profile.callsign}.` },
    { id: 1, kind: "sys", body: "Type help to list commands, or gcs to learn what this layout is." },
  ]);
  const [value, setValue] = useState("");
  const history = useRef<string[]>([]);
  const histPos = useRef(-1);
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const projects = profile.projects;

  const commands: Command[] = [
    { name: "help", desc: "List commands", run: () => help() },
    {
      name: "gcs",
      desc: "What this layout is",
      run: () =>
        [
          "A ground control station, or GCS, is where a pilot flies an unmanned aircraft from:",
          "screens for its position, sensors, and controls. This page uses the same layout.",
          "",
          "Operator      About me",
          "Flight plan   Career history, one waypoint per role",
          "Payload       Featured projects",
          "Console       This command line",
          "",
          "Everything is also below in a standard layout. Type goto about to jump there.",
        ].join("\n"),
    },
    {
      name: "whoami",
      desc: "Who I am",
      run: () => [`${profile.name}, ${profile.role}.`, profile.summary].join("\n"),
    },
    {
      name: "status",
      desc: "Availability and location",
      run: () =>
        [
          `Status     ${profile.availability.detail}`,
          `Based in   ${profile.location.label}`,
          `Clearance  ${profile.clearance}`,
          `Link       Good`,
        ].join("\n"),
    },
    {
      name: "log",
      desc: "Work history, newest first",
      run: () =>
        [...profile.experience]
          .reverse()
          .map((e) => `${e.id}  ${`${e.start} to ${e.end}`.padEnd(16)}${e.role}, ${e.org}`)
          .concat("", "Type goto experience to read the details.")
          .join("\n"),
    },
    {
      name: "missions",
      desc: "List projects",
      run: () =>
        projects
          .map((p, i) => `${String(i + 1).padStart(2)}  ${p.name.padEnd(15)}${p.tagline}`)
          .concat("", "Type open 2 to show a project in the payload view.")
          .join("\n"),
    },
    {
      name: "open",
      args: "<number>",
      desc: "Show a project in the payload view",
      run: ([arg]) => {
        const i = Number(arg);
        if (!Number.isInteger(i) || i < 1 || i > projects.length) {
          return err(`Project number must be 1 to ${projects.length}. Type missions to list them.`);
        }
        const p = projects[i - 1];
        onOpenProject(i - 1);
        return (
          <>
            Showing {p.name} in the payload view.
            {p.repo && (
              <>
                {"\n"}Code:{" "}
                <a href={p.repo} target="_blank" rel="noopener">
                  {p.repo.replace(/^https?:\/\//, "")}
                </a>
              </>
            )}
          </>
        );
      },
    },
    {
      name: "platforms",
      desc: "Experience by UAS group",
      run: () =>
        profile.platforms
          .map((p) => `Group ${p.group}  ${GROUPS[p.group].weight.padEnd(15)}${p.work}`)
          .join("\n"),
    },
    {
      name: "contact",
      desc: "Email and links",
      run: () => (
        <>
          Email     <a href={`mailto:${profile.email}`}>{profile.email}</a>
          {profile.links.map((l) => (
            <span key={l.href}>
              {"\n"}
              {l.label.padEnd(10)}
              <a href={l.href} target="_blank" rel="noopener">
                {l.href.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </span>
          ))}
        </>
      ),
    },
    {
      name: "resume",
      desc: "Open my resume (PDF)",
      run: () => {
        const w = window.open(profile.resumeUrl, "_blank");
        if (w) {
          w.opener = null;
          return "Opened the resume in a new tab.";
        }
        return (
          <>
            Your browser blocked the new tab. Open it here:{" "}
            <a href={profile.resumeUrl} target="_blank" rel="noopener">
              resume
            </a>
          </>
        );
      },
    },
    {
      name: "goto",
      args: "<section>",
      desc: `Scroll to ${sectionList}`,
      run: ([arg]) => {
        const id = (arg ?? "").toLowerCase();
        if (!SECTIONS.some((s) => s.id === id)) {
          return err(`${arg ? `There's no section called "${arg}". ` : ""}Choose ${sectionList}.`);
        }
        scrollToId(id);
        return `Scrolling to ${id}.`;
      },
    },
    {
      name: "theme",
      args: "[day|night]",
      desc: "Switch the color theme",
      run: ([arg]) => {
        const next = arg ? arg.toLowerCase() : theme === "night" ? "day" : "night";
        if (next !== "day" && next !== "night") return err(`Theme must be day or night.`);
        setTheme(next);
        return `Switched to the ${next} theme.`;
      },
    },
    {
      name: "takeoff",
      desc: "Replay the flight plan",
      run: () => {
        onReplayFlight();
        return "Cleared for takeoff. Replaying the flight plan.";
      },
    },
    {
      name: "lookup",
      desc: "Pitch up to the night sky: stargazing and myths",
      run: () => {
        markPitchUp();
        window.location.assign(SKIES_HREF);
        return "Pitching up to the night sky.";
      },
    },
    { name: "clear", desc: "Clear the console", run: () => undefined },
  ];

  function help() {
    return commands
      .map((c) => `${`${c.name}${c.args ? ` ${c.args}` : ""}`.padEnd(20)}${c.desc}`)
      .join("\n");
  }

  function err(text: string): ReactNode {
    return <span className="console__err">{text}</span>;
  }

  const run = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    history.current.push(text);
    histPos.current = -1;
    const [name, ...args] = text.split(/\s+/);
    const cmd = commands.find((c) => c.name === name.toLowerCase());

    if (cmd?.name === "clear") {
      setLines([]);
      return;
    }
    const out: ReactNode = cmd
      ? cmd.run(args)
      : err(`Unknown command "${name}". Type help to list commands.`);
    setLines((ls) => [
      ...ls,
      { id: nextId.current++, kind: "in", body: text },
      ...(out !== undefined ? [{ id: nextId.current++, kind: "out" as const, body: out }] : []),
    ]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(value);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const h = history.current;
    if (e.key === "ArrowUp" && h.length) {
      e.preventDefault();
      histPos.current = histPos.current < 0 ? h.length - 1 : Math.max(0, histPos.current - 1);
      setValue(h[histPos.current]);
    } else if (e.key === "ArrowDown" && histPos.current >= 0) {
      e.preventDefault();
      histPos.current += 1;
      if (histPos.current >= h.length) {
        histPos.current = -1;
        setValue("");
      } else setValue(h[histPos.current]);
    } else if (e.key === "Tab" && value.trim() && !value.includes(" ")) {
      // Only capture Tab while completing a command, so keyboard users can still tab out.
      e.preventDefault();
      const matches = commands.filter((c) => c.name.startsWith(value.trim().toLowerCase()));
      if (matches.length === 1) setValue(matches[0].name + " ");
      else if (matches.length > 1) {
        setLines((ls) => [...ls, { id: nextId.current++, kind: "sys", body: matches.map((m) => m.name).join("   ") }]);
      }
    }
  };

  const focusInput = () => {
    if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
  };

  return (
    <Panel id="console" title="Console" plain="Commands" meta="Type help" className="panel--console">
      <div className="console">
        <div className="console__out" ref={outRef} role="log" aria-live="polite" onClick={focusInput}>
          {lines.map((l) => (
            <p key={l.id} className={`console__line console__line--${l.kind}`}>
              {l.kind === "in" && <span className="console__prompt">gcs&gt; </span>}
              {l.body}
            </p>
          ))}
        </div>
        <div className="console__suggest">
          <span className="console__suggest-label">Run</span>
          {SUGGESTED.map((c) => (
            <button key={c} type="button" className="chip" onClick={() => run(c)}>
              {c}
            </button>
          ))}
        </div>
        <form className="console__form" onSubmit={onSubmit}>
          <label htmlFor="console-input" className="console__prompt">
            gcs&gt;
            <span className="visually-hidden"> Console command</span>
          </label>
          <input
            id="console-input"
            ref={inputRef}
            className="console__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="help"
          />
        </form>
      </div>
    </Panel>
  );
}

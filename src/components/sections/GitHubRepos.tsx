import { useEffect, useState } from "react";
import { profile } from "../../data/profile";

interface Repo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

type State =
  | { status: "unset" }
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ok"; repos: Repo[] };

const PLACEHOLDER = "your-github-username";
const CACHE_MS = 30 * 60 * 1000;
const LIMIT = 8;

const ago = (iso: string) => {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};

/** Lists public repos from the GitHub API, minus forks, archives, and the featured projects. */
export function GitHubRepos() {
  const user = profile.githubUsername.trim();
  const [state, setState] = useState<State>(() => (!user || user === PLACEHOLDER ? { status: "unset" } : { status: "loading" }));

  useEffect(() => {
    if (!user || user === PLACEHOLDER) return;
    const key = `repos:${user}`;
    const featured = new Set(
      profile.projects.map((p) => p.repo?.split("/").pop()?.toLowerCase()).filter(Boolean) as string[],
    );
    const pick = (all: Repo[]) =>
      all
        .filter((r) => !r.fork && !r.archived && !featured.has(r.name.toLowerCase()) && r.name.toLowerCase() !== `${user.toLowerCase()}.github.io`)
        .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
        .slice(0, LIMIT);

    try {
      const cached = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (cached && Date.now() - cached.t < CACHE_MS) {
        setState({ status: "ok", repos: pick(cached.repos) });
        return;
      }
    } catch {
      /* ignore bad cache */
    }

    const ctrl = new AbortController();
    fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`, {
      signal: ctrl.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(async (res) => {
        if (res.status === 403 || res.status === 429) throw new Error("GitHub's hourly rate limit was reached");
        if (res.status === 404) throw new Error(`no GitHub user named ${user}`);
        if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
        const repos: Repo[] = await res.json();
        try {
          sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), repos }));
        } catch {
          /* storage full or blocked */
        }
        setState({ status: "ok", repos: pick(repos) });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ status: "error", reason: e.message });
      });
    return () => ctrl.abort();
  }, [user]);

  const profileUrl = `https://github.com/${user}?tab=repositories`;

  return (
    <div className="repos">
      <h3 className="repos__title">More on GitHub</h3>
      {state.status === "unset" && (
        <p className="repos__note">
          Set <code>githubUsername</code> in <code>src/data/profile.ts</code> to list your public repositories here.
        </p>
      )}
      {state.status === "loading" && <p className="repos__note">Loading repositories from GitHub…</p>}
      {state.status === "error" && (
        <p className="repos__note">
          Couldn't load repositories: {state.reason}.{" "}
          <a href={profileUrl} target="_blank" rel="noopener">
            See them on GitHub
          </a>
        </p>
      )}
      {state.status === "ok" && state.repos.length === 0 && (
        <p className="repos__note">No other public repositories yet.</p>
      )}
      {state.status === "ok" && state.repos.length > 0 && (
        <>
          <ul className="repos__list">
            {state.repos.map((r) => (
              <li key={r.name} className="repo">
                <a className="repo__name" href={r.html_url} target="_blank" rel="noopener">
                  {r.name}
                </a>
                {r.description && <p className="repo__desc">{r.description}</p>}
                <p className="repo__meta">
                  {r.language && <span>{r.language}</span>}
                  {r.stargazers_count > 0 && <span>{r.stargazers_count} stars</span>}
                  <span>Updated {ago(r.pushed_at)}</span>
                </p>
              </li>
            ))}
          </ul>
          <a className="btn btn--ghost" href={profileUrl} target="_blank" rel="noopener">
            All repositories on GitHub
          </a>
        </>
      )}
    </div>
  );
}

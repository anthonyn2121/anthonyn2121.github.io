import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Reticle } from "./components/Reticle";
import { About } from "./components/sections/About";
import { Contact } from "./components/sections/Contact";
import { Experience } from "./components/sections/Experience";
import { Platforms } from "./components/sections/Platforms";
import { Projects } from "./components/sections/Projects";
import { BriefingToggle, GroundReadouts, SECTIONS, StatusBar, type NavLink } from "./components/StatusBar";
import { TerrainBackground } from "./components/TerrainBackground";
import { profile } from "./data/profile";
import { skiesTitle } from "./data/skies";
import { BriefingProvider } from "./lib/briefing";
import { onSkiesLinkClick, SKIES_HREF } from "./lib/pages";
import { ThemeProvider } from "./lib/theme";

const NAV: NavLink[] = [
  ...SECTIONS.map((s) => ({ href: `#${s.id}`, label: s.label })),
  { href: SKIES_HREF, label: skiesTitle, onClick: onSkiesLinkClick },
];

export function App() {
  useEffect(() => {
    document.title = `${profile.name}, ${profile.role}`;
  }, []);

  return (
    <ThemeProvider>
      <BriefingProvider>
        <LazyMotion features={domAnimation} strict>
          <MotionConfig reducedMotion="user">
            <a className="skip-link" href="#main">
              Skip to content
            </a>
            <TerrainBackground />
            <StatusBar homeHref="#top" nav={NAV} readouts={<GroundReadouts />} actions={<BriefingToggle />} />
            <main id="main">
              <Dashboard />
              <div className="sections">
                <About />
                <Experience />
                <Projects />
                <Platforms />
                <Contact />
              </div>
            </main>
            <footer className="footer">
              <p>
                {profile.name}, {new Date().getFullYear()}. Built with React and hosted on GitHub Pages.
              </p>
              <p className="footer__links">
                <a href={SKIES_HREF} onClick={onSkiesLinkClick}>
                  {skiesTitle}
                </a>
                <a href="#top">Back to top</a>
              </p>
            </footer>
            <Reticle />
          </MotionConfig>
        </LazyMotion>
      </BriefingProvider>
    </ThemeProvider>
  );
}

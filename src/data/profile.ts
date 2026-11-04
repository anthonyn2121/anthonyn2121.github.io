/**
 * ─────────────────────────────────────────────────────────────────────────
 *  All site content lives in this file. Replace the placeholders with your
 *  own details. Every field is used somewhere on the page.
 *
 *  Keep descriptions public-release safe: no ITAR-controlled technical data,
 *  CUI, program names under NDA, or anything your employer hasn't cleared.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type UasGroup = 1 | 2 | 3 | 4 | 5;

export interface ExternalLink {
  label: string;
  href: string;
}

export interface ExperienceEntry {
  /** Short id used for the page anchor, e.g. "WP3". */
  id: string;
  role: string;
  org: string;
  location: string;
  start: string;
  /** Use "Present" for your current role. */
  end: string;
  groups: UasGroup[];
  summary: string;
  highlights: string[];
}

export interface Project {
  /** Used for the page anchor (#project-slug). */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  tech: string[];
  groups: UasGroup[];
  /** Full URL to the repository, if public. */
  repo?: string;
  /** Full URL to a live demo, video, or write-up. */
  demo?: string;
  /** Optional screenshot in /public, e.g. "/projects/mavdeck.png". */
  image?: string;
  /**
   * What represents this project on the flight-deck page (/carrier/). Defaults to a jet;
   * "quadcopter" parks a Group 1 quadcopter on a UAS pad instead.
   */
  vehicle?: "quadcopter";
}

export interface PlatformWork {
  group: UasGroup;
  /** One or two sentences on what you did with aircraft in this group. */
  work: string;
  /** Generic aircraft types you've worked on. Avoid controlled program names. */
  types: string[];
}

export interface Profile {
  name: string;
  callsign: string;
  role: string;
  summary: string;
  location: { label: string; lat: number; lon: number };
  availability: { open: boolean; short: string; detail: string };
  yearsExperience: number;
  email: string;
  githubUsername: string;
  resumeUrl: string;
  photo: string;
  links: ExternalLink[];
  about: string[];
  experience: ExperienceEntry[];
  projects: Project[];
  platforms: PlatformWork[];
  skills: { area: string; items: string[] }[];
}

export const profile: Profile = {
  name: "Your Name",
  /** Short handle shown next to your name in the top bar. */
  callsign: "YN-01",
  role: "UAS systems engineer",
  summary:
    "I design, integrate, and flight-test unmanned aircraft, from hand-launched quadcopters to high-altitude, long-endurance platforms.",

  location: {
    label: "Dayton, OH",
    /** Used for the cursor coordinate readout in the top bar. */
    lat: 39.7589,
    lon: -84.1916,
  },

  availability: {
    open: true,
    short: "Open to roles",
    detail: "Open to systems engineering and flight test roles",
  },

  yearsExperience: 7,

  email: "you@example.com",
  /** Your GitHub username. Used to list your public repositories. */
  githubUsername: "your-github-username",
  /** Put your resume at public/resume.pdf, or point this at another URL. */
  resumeUrl: "/resume.pdf",
  /** Optional headshot in /public, e.g. "/me.jpg". Leave empty to hide. */
  photo: "",

  links: [
    { label: "GitHub", href: "https://github.com/your-github-username" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/your-profile" },
  ],

  about: [
    "I started out building multirotor test rigs in a university lab and have since worked on every class of unmanned aircraft the DoD defines, from 5 lb quadcopters to HALE aircraft flying above 50,000 ft.",
    "Most of my work sits where software meets the airframe: integrating payloads and datalinks, writing ground control tooling, and planning the flight tests that prove it all works. I like problems where a simulation result has to survive contact with real wind, real RF, and real operators.",
    "Right now I'm focused on mission autonomy and contingency management, the logic that decides what an aircraft does when the link drops or the weather turns.",
  ],

  experience: [
    {
      id: "WP1",
      role: "Undergraduate researcher",
      org: "University UAS Lab",
      location: "Columbus, OH",
      start: "2017",
      end: "2018",
      groups: [1],
      summary: "Built and flew multirotor test rigs for sensor payload research.",
      highlights: [
        "Designed a vibration-isolated gimbal mount that cut image blur in hover by about 40%.",
        "Ran more than 120 test flights as pilot in command under Part 107.",
      ],
    },
    {
      id: "WP2",
      role: "Flight test engineer",
      org: "Acme Unmanned Systems",
      location: "Pendleton, OR",
      start: "2018",
      end: "2020",
      groups: [2, 3],
      summary: "Planned and ran flight test campaigns for catapult-launched fixed-wing aircraft.",
      highlights: [
        "Wrote test cards and range safety plans for 60+ sorties.",
        "Built a Python pipeline that turned flight logs into test reports overnight instead of in a week.",
        "Led launch and recovery crew training for a new expeditionary configuration.",
      ],
    },
    {
      id: "WP3",
      role: "Systems integration engineer",
      org: "Example Aerosystems",
      location: "San Diego, CA",
      start: "2020",
      end: "2023",
      groups: [3, 4],
      summary: "Integrated payloads and datalinks on medium-altitude, long-endurance aircraft.",
      highlights: [
        "Owned the interface between onboard payloads and the ground control station software.",
        "Cut payload integration time from 6 weeks to 2 with a reusable hardware-in-the-loop bench.",
      ],
    },
    {
      id: "WP4",
      role: "Senior autonomy engineer",
      org: "Placeholder Aerospace",
      location: "Dayton, OH",
      start: "2023",
      end: "Present",
      groups: [4, 5],
      summary: "Develop mission autonomy and lost-link contingency logic for high-altitude operations.",
      highlights: [
        "Lead a team of four building contingency management software in C++ and ROS 2.",
        "Defined the simulation test matrix used to certify autonomy updates before flight.",
      ],
    },
  ],

  projects: [
    {
      slug: "sitl-sweep",
      name: "sitl-sweep",
      tagline: "Runs hundreds of failure scenarios against PX4 overnight",
      description:
        "A test harness that launches PX4 software-in-the-loop simulations in parallel, injects faults like GPS loss, link loss, and gusts, then reports which scenarios broke the failsafe logic.",
      highlights: [
        "Runs 400 scenarios in about 3 hours on a single workstation.",
        "Caught three failsafe regressions before they reached flight test.",
      ],
      tech: ["Python", "PX4", "Gazebo", "ROS 2", "GitHub Actions"],
      groups: [1, 2],
      vehicle: "quadcopter",
      repo: "https://github.com/your-github-username/sitl-sweep",
    },
    {
      slug: "mavdeck",
      name: "mavdeck",
      tagline: "A browser ground station for MAVLink vehicles",
      description:
        "A lightweight web dashboard that shows live MAVLink telemetry over WebSockets: attitude, position on a moving map, battery, and link quality. Useful for a second screen at the field.",
      highlights: [
        "Renders telemetry at 20 Hz without dropping frames on a tablet.",
        "Supports several vehicles at once with per-vehicle alerting.",
      ],
      tech: ["TypeScript", "React", "MAVLink", "WebSockets"],
      groups: [1, 2, 3],
      repo: "https://github.com/your-github-username/mavdeck",
      demo: "https://your-github-username.github.io/mavdeck",
    },
    {
      slug: "trimcalc",
      name: "trimcalc",
      tagline: "Trim and endurance estimates for small fixed-wing aircraft",
      description:
        "A Python library and set of notebooks that compute trim conditions, stall margins, and endurance from basic airframe and propulsion parameters.",
      highlights: [
        "Matched flight-test endurance within 6% on two airframes.",
        "Used by a university team for their competition aircraft sizing.",
      ],
      tech: ["Python", "NumPy", "SciPy", "Jupyter"],
      groups: [2, 3],
      repo: "https://github.com/your-github-username/trimcalc",
    },
    {
      slug: "geofence-lint",
      name: "geofence-lint",
      tagline: "Checks mission plans against geofences before upload",
      description:
        "A command-line tool that validates waypoint missions against geofence and airspace polygons, flags legs that clip a boundary, and suggests the smallest fix.",
      highlights: [
        "Parses QGroundControl and Mission Planner formats.",
        "Runs in under 50 ms for a 500-waypoint mission.",
      ],
      tech: ["Rust", "GeoJSON", "CLI"],
      groups: [1, 2, 3, 4],
      repo: "https://github.com/your-github-username/geofence-lint",
    },
  ],

  platforms: [
    {
      group: 1,
      work: "Built, tuned, and flew research multirotors; wrote PX4 test tooling.",
      types: ["Quadcopters", "Hexacopters", "Hand-launched fixed-wing"],
    },
    {
      group: 2,
      work: "Flight test planning and log analysis for catapult-launched aircraft.",
      types: ["Catapult-launched fixed-wing", "VTOL fixed-wing"],
    },
    {
      group: 3,
      work: "Launch and recovery operations; early payload integration work.",
      types: ["Tactical twin-boom fixed-wing", "Runway-independent fixed-wing"],
    },
    {
      group: 4,
      work: "Payload and datalink integration; ground control station interfaces.",
      types: ["Medium-altitude long-endurance (MALE)", "Unmanned helicopters"],
    },
    {
      group: 5,
      work: "Mission autonomy and lost-link contingency management.",
      types: ["High-altitude long-endurance (HALE)"],
    },
  ],

  /** Tools and skills grouped for the Platforms section. */
  skills: [
    { area: "Flight software", items: ["PX4", "ArduPilot", "ROS 2", "MAVLink", "C++", "Python"] },
    { area: "Simulation and test", items: ["Gazebo", "SITL and HITL", "MATLAB/Simulink", "Test card design"] },
    { area: "Systems", items: ["Payload integration", "Datalinks", "DO-178C awareness", "Requirements in DOORS"] },
  ],
};


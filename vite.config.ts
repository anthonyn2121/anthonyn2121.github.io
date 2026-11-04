import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A user site (username.github.io) is served from the domain root, so base is "/".
// If you deploy to a project repo instead (username.github.io/repo-name), set base to "/repo-name/".
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    rolldownOptions: {
      // Two pages: the portfolio, and "Above the skies" at /skies/.
      input: {
        main: "index.html",
        skies: "skies/index.html",
      },
    },
  },
});

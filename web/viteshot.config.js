const playwrightShooter = require("viteshot/shooters/playwright");
const playwright = require("playwright");
const viteCommonjs = require("@originjs/vite-plugin-commonjs").viteCommonjs;
const vite = require("vite");

module.exports = {
  framework: {
    type: "react"
  },
  vite: vite.defineConfig({
    base: "./",
    plugins: [viteCommonjs()],
    optimizeDeps: {
      include: ['attr-accept', '@patternfly/react-styles']
    }
  }),
  shooter: playwrightShooter(playwright.chromium, {
    contexts: {
      desktop: playwright.devices["Desktop Chrome"],
      desktopHiDPI: playwright.devices["Desktop Chrome HiDPI"],
      pixel5: playwright.devices["Pixel 5"]
    }
  }),
  filePathPattern: "**/*.screenshot.@(js|jsx|tsx|vue|svelte)",

  wrapper: {
    path: "src/ScreenshotsWrapper.jsx",
    componentName: "ScreenshotsWrapper"
  }
};

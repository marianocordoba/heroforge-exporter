# HeroForge Exporter — Safari Web Extension

A complete MV3 Web Extension. Safari can't load an unpacked folder like
Chrome — it must be wrapped in an Xcode app and signed. Apple's converter
does the wrapping.

## How it works
- `content.js` runs in the isolated content-script world; it can't see
  HeroForge's `CK` / `RK` globals, so it injects `inject.js` into the page's
  MAIN world via a <script> tag.
- `inject.js` is the exporter bundle (self-contained, injects its own CSS).
  It mounts the collapsible widget bottom-left and exports STL + downloads it.
- No extension permissions needed — download is a Blob + anchor click.

## Build (macOS + Xcode)
The earlier "Could not find extension at ..." error just means the converter
was pointed at a path that wasn't there. Give it the FULL path to this folder
(the one containing manifest.json). Easiest way to get the path exactly right:

1. In Terminal, type (with the trailing space):

       xcrun safari-web-extension-converter --app-name "HeroForge Exporter"

2. Then DRAG this `HeroForgeExporter` folder from Finder onto the Terminal
   window — it pastes the correct absolute path. Press Enter.

   The whole line ends up looking like:

       xcrun safari-web-extension-converter --app-name "HeroForge Exporter" /Users/you/Downloads/HeroForgeExporter

Optional: add `--bundle-identifier studio.giantmushroom.heroforge-exporter`
(change to whatever you like) so you're not on the default.

Then:
1. Xcode opens the generated project. Pick your team under Signing &
   Capabilities (a free Apple ID works for local use).
2. Build & Run (Cmd-R) — the container app launches.
3. Safari ▸ Settings ▸ Extensions ▸ tick HeroForge Exporter.
   Dev builds: first enable Safari ▸ Settings ▸ Advanced ▸ "Show features for
   web developers", then Develop ▸ Allow Unsigned Extensions (resets each launch).

## Updating the exporter
`inject.js` is a copy of the repo's `dist/hfe.js`. Rebuild the repo
(`bun install && bun run build`) and copy `dist/hfe.js` over `inject.js`.

## If page CSP ever blocks the injected script
Remove `content.js` and the `web_accessible_resources` block, and declare the
bundle as a main-world content script (Safari 16.4+):

    "content_scripts": [{
      "matches": ["*://*.heroforge.com/*"],
      "js": ["inject.js"],
      "world": "MAIN",
      "run_at": "document_idle"
    }]

## Credit
Exporter by Mariano Córdoba (MIT). Not affiliated with HeroForge; respect
their ToS and IP.

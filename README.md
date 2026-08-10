# Cofig — Component Documentation Generator

A Figma plugin that generates a full Razorpay-Blade-style documentation page for
any component you select, in one run.

Select a component → the plugin reads its properties, variants, bound variables
and layer structure → it draws a new page with Introduction, anatomy, a props
table, a tokens table, variations, usage guidelines, content guidelines,
platforms, accessibility and a changelog.

See [ANALYSIS.md](ANALYSIS.md) for the teardown of the Blade file this is
modelled on — the measurements in the code all come from there.

## Install

No build step. The plugin is plain JavaScript.

1. Figma desktop app → menu → **Plugins → Development → Import plugin from manifest…**
2. Pick `manifest.json` in this folder.
3. It now appears under **Plugins → Development → Cofig**.

## Use

1. Select a component, a component set, or an instance on the canvas.
2. Run the plugin. The panel fills itself in from the component.
3. Fix the prose — the introduction, guidelines and prop descriptions are
   drafted for you, but they are drafts. This is the part worth your time.
4. **Generate documentation.**

It creates a page named `❖ <ComponentName>` with the sections laid out left to
right, 120px apart, exactly as Blade lays them out.

Running it again on the same component **updates that page in place** rather
than making a second one. Your edits are remembered per component, so a
re-run after a component change keeps your writing and refreshes the props,
tokens and specimens.

A re-run only replaces the sections Cofig itself created. Anything else you
keep on that page — the component set, scratch frames, annotations — is left
alone, so you can park the component below its docs the way Blade does.

## What is derived automatically

| Section | Where it comes from |
| --- | --- |
| Props table | `componentPropertyDefinitions` — names, types, variant options, defaults |
| Tokens table | Bound variables where present, measured padding/gap/radius/fills where not |
| Anatomy | Layer names, drawn on an instance with every boolean property switched on so optional parts are visible |
| Variations | Size, container type, and every state once per style value |
| Platforms | Desktop / tablet / mobile specimens |
| Introduction | The component's Figma description if it has one, otherwise a template |
| Guidelines, a11y, changelog | Editable templates |

## Panel

- **Overview** — system name, docs link, status badge, introduction, which
  sections to generate, anatomy labels.
- **Props** — every detected property with an editable description, default and
  required flag. Detected tokens are listed underneath.
- **Guidance** — usage and content guidelines, each becoming a block with a Do
  and a Don't card.
- **A11y & Log** — accessibility notes and changelog entries.

## Notes

- **Fonts.** Blade uses TASA Orbiter Display, Inter and Menlo. The plugin probes
  what is installed and falls back (TASA → Inter, Menlo → Roboto Mono → Courier
  New). Nothing breaks if you have none of them.
- **Anatomy labels** are only as good as your layer names. Layers named
  `container`, `frame`, `group` and similar are skipped, parenthetical notes and
  leading symbols are stripped, and you can rewrite every label in the panel.
- **Dark anatomy** is off by default. Turn it on only if your component renders
  correctly on a dark surface — unlike Blade's, most components do not.
- The plugin never makes network requests; `networkAccess` is set to `none`.

## Files

| File | What it is |
| --- | --- |
| `manifest.json` | Plugin manifest |
| `code.js` | Main thread: analysis of the component and all canvas drawing |
| `ui.html` | The panel, single file, no dependencies |
| `ANALYSIS.md` | Teardown of the Blade documentation system |

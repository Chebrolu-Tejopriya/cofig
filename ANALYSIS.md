# How Razorpay documents Blade in Figma

A structural teardown of the [Blade Design System (Community)](https://www.figma.com/design/j385ovMq8Jar3IsGTWABBW/Blade-Design-System--Community-)
file, read through the Figma Plugin API rather than by eye, so the numbers below
are the actual values on the canvas.

The file has **61 pages**, organised with typographic separators as page names:

| Group | Pages |
| --- | --- |
| `📘 FOUNDATIONS ━━━` | Typography, Colors, Icons, Layout, Object Styles, Motion, Utilities, Tokens |
| `💼 COMPONENTS ━━━` | 36 pages, one per component, each prefixed `❖ ` |
| `⤵️ IN PROGRESS ━━━` | 9 pages, each prefixed `⚠️ ` |
| `🗂 INTERNALS ━━━` | `_Central` (the documentation kit), `_Deprecation Ground`, coverage |

## 1. One page per component, sections laid left to right

A component page is not a vertical document. Every section is a separate
top-level frame, all sharing the same `y`, marching rightwards with a **120px
gutter**. Measured on `❖ Alert`:

```
_Thumb        x=50    w=380     ← 380×272 card used in the Figma library browser
_Introduction x=550   w=1049    ← 430 + 120 = 550
_Component Props      x=1719   w=1096
_Variations   x=2935  w=1512
_Usage Guidelines     x=4567   w=2368
_Platforms    x=7055  w=1029
_Accessibility        x=8204   w=896
```

Section frames are always white, always padded **48px** on all four sides, and
their names always start with an underscore so they sort together and read as
scaffolding rather than content.

The section set is consistent but not rigid. Every component has Introduction,
Props, Variations, Usage Guidelines, Platforms and Accessibility. Richer
components add more: `Card` also carries `_Content Guidelines`, `_Changes`, and
two `_Motion Guidelines` frames; `Tag` carries `_Motion Guidelines`.

## 2. Every section is built from the same three parts

```
_SectionName                     FRAME, vertical, padding 48, fill #ffffff
└── content                      vertical, gap 32
    ├── .frame-header            the title block, 1px bottom rule #e3eaf3
    └── Body                     vertical, gap 24–40
        ├── <block>
        ├── <block>
        └── …
```

And every block inside `Body` is the same shape again:

```
<block>                          vertical, gap 24
├── .Text Item                   heading + muted description
├── body                         the specimens
└── _SectionDivider / Thick      2px rule, #c1c8cf
```

That recursion is the whole trick. Two containers and a divider, repeated, is
what makes 36 component pages look like one document.

## 3. The internal documentation kit

`_Central` holds 71 components. These are the ones that carry the documentation
itself — note that they are all named with a leading `.` or `_` so they never
appear in the published library:

| Component | Variants | Properties |
| --- | --- | --- |
| `.frame-header` | Documentation, Component, Sub-Component, Foundation | `Title`, `SubTitle`, `Description`, `showBadge`, `showStatus`, `showResources`, `showDescription` |
| `.Text Item` | borderLess True/False | `title`, `description` |
| `.prop` | tableHeaderRow True/False | `Title`, `Type`, `Description`, `Prop Values`, `defaultValue`, `isMandatory` |
| `.Token` | Header, Row | `name`, `description`, `showLegendCell` |
| `.usage-markers` | Uses, DOs, DOnts | — |
| `.anatomy-marker` | direction × variant (Top/Left/Right/Bottom × Line/Shape) | `label` |
| `.changelog-row-item` | Added, Fixed, Removed, Deprecated, Published | `Changelog Text`, `Version Number`, `Change Date` |
| `.Badge` | Published, In Progess, Version Number, Deprecated | — |
| `.icon-container` | Loom, Figma, Storybook | — |
| `_Notes` | General, Attention | — |

The important idea: **the documentation is itself a component library.** Writing
a doc page is filling in component properties, not drawing. That is why 36 pages
stay consistent, and it is exactly what the plugin reproduces in code.

## 4. Measured design language

Typography — Blade uses `TASA Orbiter Display` for display text, `Inter` for
body, and `Menlo` for code:

| Role | Font | Size / line height | Colour |
| --- | --- | --- | --- |
| Eyebrow (`Blade DSL / Documentation`) | TASA Orbiter Display Regular + Medium | 20 / 26 | `#768ea7` |
| Section title | TASA Orbiter Display SemiBold | 32 / 38 | `#192839` |
| Section description | Inter Regular | 16 / 24 | `#768ea7` |
| Block heading | TASA Orbiter Display SemiBold | 20 / 26 | `#192839` |
| Block body | Inter Regular | 14 / 20 | `#768ea7` |
| Do / Don't heading | TASA Orbiter Display SemiBold | 24 / 32 | `#00a251` / `#d13821` |
| Table header | Inter SemiBold | 16 / 24 | `#202223` |
| Prop name | Menlo Bold | 14 / 20 | `#192839` |
| Prop type | Menlo Regular | 14 / 20 | `#305eff` |
| Anatomy label | Inter Medium | 11 / 16 | `#40566d` |

Colour roles:

| Token | Value | Used for |
| --- | --- | --- |
| ink | `#192839` | titles, prop names |
| body | `#768ea7` | descriptions, eyebrow, footer link |
| strong | `#40566d` | table cell values |
| header rule | `#e3eaf3` | the 1px line under every section header |
| row rule | `#6c849d` at 18% | table row separators |
| table header fill | `#f1f5fa` | table headers and specimen stages |
| code | `#305eff` | types and token names |
| required | `#d92d20` | the `*` on mandatory props |
| do / don't | `#00a251` / `#d92d20` at 9% | guidance card backgrounds |
| anatomy pointer | `#e9690c` | leader lines |

## 5. The props table

1000px wide, five columns: **200 / 280 / 120 / 200 / 200**. Header row filled
`#f1f5fa`, every row separated by a 1px bottom rule. Cell padding is 16px on
data rows, 8/16 on the header.

Real content, from `Alert`:

| Prop Name | Description | Type | Prop Values | Default |
| --- | --- | --- | --- | --- |
| `color` * | Shows the intent of the component | string | Positive, Negative, Notice, Information, Neutral | Notice |
| `emphasis` | Shows the intensity of the component | string | Subtle, Intense | Subtle |
| `isDismissible` | Toggle the close icon from the component | boolean | True, False | False |

Two things worth copying: the type column is set in mono and coloured like code,
which silently tells a developer this is an API surface rather than prose; and
mandatory props are marked with a red `*` rather than a separate column.

## 6. The tokens table

Two columns, 280 / 720. This is the bridge between the Figma component and the
code implementation, and the values are written as code, not as pixel numbers:

```
Horizontal Padding    padding-horizontal: theme.global.spacing.04
Icon Size             theme.global.iconSize.medium
Background            theme.feedback.background.positive.<contrast>
Border Radius         isFullWidth=true  → theme.global.borderRadius.none
                      isFullWidth=false → theme.global.borderRadius.medium
```

Note the last one: where a token depends on a prop, they write the condition
inline rather than splitting the table.

## 7. Anatomy diagrams

The Introduction section ends with the component drawn on a `#f1f5fa` stage,
with parts labelled by leader lines in `#e9690c`. Blade draws each one twice —
once light, once dark — because their components carry both themes.

Labels sit on shared horizontal bands outside the component and the line runs
from the part itself out past the component edge. That detail matters: anchoring
labels to bands rather than to each part's own edge is what stops labels
colliding when two parts sit at the same `x`.

## 8. Do / Don't

```
body                    horizontal, gap 24
├── dos                 main-content: fill #00a251 @ 9%, radius 8, padding 32
│   ├── text-container  .usage-markers (green dot + "Do") + caption #58728d
│   └── example-frame   white, padding 48, the specimen
└── donts               same, fill #d92d20 @ 9%, "Don't" in #d13821
```

Both halves always show a real component instance, never a screenshot — so the
guidance stays correct when the component changes.

---

# What the plugin does with this

`code.js` rebuilds the whole language from scratch rather than depending on
Blade's `_Central` library, so it works in any Figma file. It reads a selected
component and derives:

- **Props table** from `componentPropertyDefinitions` — variant options become
  Prop Values, `VARIANT`/`TEXT` become required, `INSTANCE_SWAP` becomes
  `ReactNode` and its default node id is resolved to a component name.
- **Tokens table** from bound variables where they exist, and from measured
  values where they do not, so the table is useful in files that have not
  adopted variables yet.
- **Anatomy** from layer names, cleaned of the housekeeping designers leave
  behind (`(don't hide/unhide)`, leading `×`), with collision-free leader lines.
- **Variations** by instancing the component once per variant value.
- **Everything prose** — introduction, guidelines, accessibility, changelog —
  from editable defaults you correct in the panel before generating.

Fonts degrade automatically: `TASA Orbiter Display` → Inter, `Menlo` →
Roboto Mono → Courier New, so the output looks right without Blade's licensed
fonts installed.

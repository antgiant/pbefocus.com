# pbefocus.com
The home for pbefocus.com

## Shared branding

`brand.css` is the family's visual identity layer: one accent color per site (quiz ruby,
karaoke leaf green, score keeper royal blue; pbefocus.com keeps the family teal), the accent
bar, header lockup (each tool leads with its own mark; the home page keeps the PBEfocus.com logo), nav dots and
button fills. Each page sets `<html data-site="...">` and
links `brand.css` after its own stylesheet.

This repo is the **source of truth**. `quiz.pbefocus.com` and `karaoke.pbefocus.com` carry a
vendored copy at `assets/css/brand.css` (same-origin, so their service workers cache it for
offline use). After editing `brand.css`, run `node scripts/sync-brand.mjs` to copy it to the
sibling checkouts, and `node scripts/sync-brand.mjs --check` to see whether any copy drifted.

Per-site marks live in `assets/marks/` (used on the home page cards); the same artwork ships in
each tool repo as `assets/site-mark*.svg`.

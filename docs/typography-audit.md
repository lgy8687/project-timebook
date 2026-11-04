# Typography Audit

Scope: root web-app CSS, HTML and JavaScript; source census, not a claim of complete rendered-screen acceptance.

Findings before cleanup:
- design-system.css: 159 font-size declarations, 53 literal sizes.
- style.css: 132 declarations, 121 literal sizes.
- report.css: 99 declarations, 99 literal sizes.
- app.js: 3 literal font-size declarations; HTML and generated markup also contain text utility classes.
- The written role scale disagreed with the CSS tokens. Event home had a 20px title and inherited group-label size.

Changes:
- Replaced 223 declarations within the existing 10-20px palette with equivalent tokens. This migration preserves those numerical sizes.
- Page title: 16px; section title: 15px; body/control/activity name: 13px; auxiliary text: 11px.
- Event-home header, group labels, card names and timestamps explicitly use semantic roles.
- docs/design-system.md is synchronized with the semantic tokens. Existing user appearance settings remain supported.

Remaining review:
- Legacy utility classes and JavaScript inline sizes are not fully migrated.
- Larger icon glyphs, timers, indicators, chart geometry and native input text have intentional independent requirements.
- Token adoption alone does not prove semantic correctness; populated/empty screens and user appearance settings still require visual review.
- Run `node --test tests/typography.test.js` to reject reintroduced literal sizes from the standard palette in the three shared stylesheets.

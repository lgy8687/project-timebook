# Interface Rules

- Typography source of truth: semantic tokens in design-system.css. Page titles use --ui-heading-1 (16px/700); section titles use --ui-heading-2 or --ui-heading-3 (15px/700); body, control labels and activity names use --ui-body (13px/500-600); secondary descriptions use --ui-caption (11px/400). Line height is 1.4 for titles and controls, 1.5 for body copy. Do not infer text size from its clickable area's dimensions.
- The --ui-type-* tokens are the existing size palette, not semantic roles. Prefer semantic tokens for new ordinary text. Native text-entry fields may remain 16px to avoid mobile browser focus zoom. Timers, primary totals, chart labels and icons are separate display roles; do not reduce them in a bulk text adjustment. Explicit user appearance preferences remain supported.
- Use the system sans-serif stack throughout. Numeric times use tabular figures. Letter spacing is zero.
- Normal text is #334155, secondary text #64748b. Interaction accent is #526a91 with a light #edf2f8 surface. Red is reserved for destructive actions. Category and scene colors continue to represent the user's data.
- Segmented controls use one shared style for report periods, main/parallel views, category settings, summary settings and recording mode. Equal-width options, 36px minimum inner height, filled selected state.
- Regular actions are at least 40px high; modal confirmation buttons are 44px. Icon-only actions retain descriptive accessible labels.
- Keep 8/12/16/20px spacing. Category, main shortcut and parallel shortcut settings remain separate tabs. Shortcut selection continues to use the existing drawer.
- Shared rules live in design-system.css, loaded after page-specific styles. Theme defaults in ui-theme.js follow the same scale; explicit user appearance preferences remain supported.
- Check mobile widths 320px and 390px plus desktop. Verify populated and empty reports, category tabs, drawers and time-edit dialogs. Never resize or expose the swipe-action layer when adjusting row appearance.

# Changelog

## [Unreleased] — Bootstrap 5 migration

### Breaking changes

- **`--style` / `-s` CLI option now accepts plain CSS instead of Less.**
  If you previously passed a `.less` file, convert it to plain CSS before upgrading.
  Custom styles are appended after Bootstrap 5 + the default `style.css`, so you can
  override any CSS custom property or rule.

### Added

- Bootstrap 5.3.3 replaces Bootstrap 2 (CSS + JS bundle with Popper included)
- Dark mode support: follows `prefers-color-scheme` by default; 🌙/☀️ toggle button
  in the sidebar overrides and persists preference via `localStorage`
- Popovers stay open when the mouse moves into them — text can be selected and links clicked

### Removed

- `less` and `less-middleware` npm dependencies
- All vendored Bootstrap 2 Less source files
- Bootstrap 2 vendor JS files (`bootstrap-tooltip.js`, `bootstrap-popover.js`)

### Changed

- Badge classes updated to Bootstrap 5 naming (`label` → `badge`, `label-info` → `text-bg-info`)
- Popover API updated from jQuery plugin to Bootstrap 5 Vanilla JS (`new bootstrap.Popover()`)
- Body font size restored to 14 px (Bootstrap 5 defaults to 16 px)
- Mobile viewport set to fixed 1200 px width — full desktop site is shown on mobile (pinch to zoom)
- Footer correctly pinned to bottom of page

## Previous releases

See git log for history prior to this migration.

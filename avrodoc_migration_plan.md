# Migration Plan: Bootstrap 5 + Nunjucks

Migrate away from the legacy frontend stack (Bootstrap 2, Less CSS, DustJS, jQuery, Sammy.js) in two independent phases. Each phase produces a working, shippable result.

---

## Current stack (before migration)

| Concern | Technology | Status |
|---|---|---|
| CSS framework | Bootstrap 2 (vendored Less subset) | ⚠️ Abandoned ~2013 |
| CSS pre-processor | Less 1.7.x | ⚠️ Old API |
| Template engine | DustJS (client-side) | ⚠️ Abandoned 2017 |
| DOM / AJAX | jQuery 3.6 | Required by DustJS + Sammy |
| Client-side router | Sammy.js 0.7.6 | ⚠️ Abandoned |
| Popover / tooltip | Bootstrap 2 JS plugins (jQuery) | ⚠️ Abandoned |

---

## Why Bootstrap 5 (not Pico CSS)

[Pico CSS](https://picocss.com) is a classless/minimal framework — great for content sites, but a poor fit here because:

- The app has a **custom fixed-sidebar layout** that fights Pico's opinions.
- Pico has **no popover/tooltip component**. The app relies heavily on hover popovers to show type details inline. With Pico you'd have to build this from scratch or add another library.
- PR #349 demonstrated this: it ended up using Pico's CSS variables as fallbacks inside custom CSS, negating Pico's main benefit.

**Bootstrap 5** is the right choice because:

- **Built-in Popover API** using Vanilla JS (`new bootstrap.Popover(el, {...})`), no jQuery required.
- **Bootstrap 5 dropped jQuery** entirely — removing it is a free bonus.
- **First-class dark mode** via `data-bs-theme="dark"` on the `<html>` element, plus CSS custom properties for fine-grained overrides.
- Existing Dust templates already use Bootstrap class names (`table-striped`, `table-hover`, `label`, etc.) — most renames are mechanical (`label` → `badge`).
- Actively maintained (v5.x).

---

## Why Nunjucks SSR (not Eleventy, not Handlebars)

The current architecture renders templates **client-side in the browser** using precompiled DustJS templates + Sammy.js for hash routing. This was reasonable in 2013; today it's unnecessary complexity for a **documentation generator** where all data is known at generation time.

### Option considered: keep CSR, replace DustJS with Handlebars
- Similar precompile-to-browser model, actively maintained.
- Still requires a client-side router (Sammy.js replacement) and jQuery/fetch wiring.
- Does not eliminate the complexity — just swaps one abandoned library for another.

### Chosen: move to SSR with Nunjucks
- `nunjucks` npm package used **directly in `static_content.js`** — no framework needed.
- Eleventy is a static site generator framework; it is **not required** here. Just `nunjucks` directly.
- All schema data is known at doc-generation time → render to HTML server-side, embed in the output.
- Navigation: Vanilla JS hash-based show/hide of pre-rendered sections (keeps SPA feel, no full-page reloads).
- Eliminates from the browser: DustJS, jQuery, Sammy.js.
- Template syntax is a mechanical conversion (see mapping below).

---

## Phase 1 — Replace Less + Bootstrap 2 with Bootstrap 5 ✅ Done

**Goal:** Ship a working app with Bootstrap 5, dark mode, no Less dependency. Keep DustJS and jQuery for now.

### Changes made

- Removed `less` and `less-middleware` npm dependencies.
- Deleted all `.less` source files (`public/stylesheets/bootstrap/*.less`, `variables.less`, `footer.less`, `print-style.less`, `style.less`) and Less type stubs.
- Deleted Bootstrap 2 vendor JS files (`bootstrap-tooltip.js`, `bootstrap-popover.js`).
- Added Bootstrap 5.3.3: `public/stylesheets/bootstrap.min.css` and `public/vendor/bootstrap.bundle.min.js` (includes Popper).
- Wrote new `public/stylesheets/style.css` using Bootstrap 5 CSS custom properties for the fixed sidebar layout, content pane, popovers, and dark mode.
- Updated `src/static_content.js`: removed Less compilation, reads CSS files directly. The `--style`/`-s` CLI option now accepts **plain CSS** instead of Less.
- Updated `app.js`: removed `less-middleware`.
- Updated `public/js/avrodoc.js`: replaced jQuery `$(el).popover({...})` with Bootstrap 5 Vanilla JS `new bootstrap.Popover(el, {...})`.
- Updated Dust templates: `label` → `badge`, `label-info` → `text-bg-info` (Bootstrap 5 naming).
- Updated `src/top_level.dust`: added `lang="en"`, standard responsive viewport, dark mode toggle button.
  - Dark mode follows OS `prefers-color-scheme` by default.
  - A 🌙/☀️ toggle button in the sidebar lets users override, persisted via `localStorage`.
- Fixed `.gitignore`: `style.css` is now a committed source file (not generated).

### Breaking change

The `--style`/`-s` CLI option now accepts plain CSS files instead of Less files.

---

## Phase 2 — Replace DustJS + jQuery + Sammy.js with Nunjucks SSR

**Goal:** Eliminate all legacy JS from the browser. Render documentation server-side using Nunjucks. Replace jQuery DOM manipulation and Sammy.js routing with Vanilla JS.

### Step-by-step

#### 1. Add Nunjucks, remove DustJS

```
npm install nunjucks
npm uninstall dustjs-linkedin dustjs-helpers
```

Remove type stubs `types/dustjs-helpers/` and `types/dustjs-linkedin/`.

#### 2. Convert templates

Convert all 13 `.dust` templates and `src/top_level.dust` to Nunjucks (`.njk`).

**Dust → Nunjucks syntax mapping:**

| Dust | Nunjucks |
|---|---|
| `{field}` | `{{ field }}` |
| `{field\|s}` (unescaped) | `{{ field \| safe }}` |
| `{field\|md\|s}` (markdown) | `{{ field \| markdown \| safe }}` |
| `{#list}...{/list}` | `{% for item in list %}...{% endfor %}` |
| `{?field}...{:else}...{/field}` | `{% if field %}...{% else %}...{% endif %}` |
| `{>partial:ctx/}` | `{% include "partial.njk" %}` |
| `{! comment !}` | `{# comment #}` |
| `{@sep}...{/sep}` (in loop) | `{% if not loop.last %}...{% endif %}` |

Define a `markdown` filter in Nunjucks config to replace `dust.filters.md`.

**Templates to convert (385 lines total):**

| File | Lines |
|---|---|
| `src/top_level.dust` → `src/top_level.njk` | 36 |
| `templates/annotations_list.dust` | 26 |
| `templates/detail_enum.dust` | 12 |
| `templates/detail_message.dust` | 78 |
| `templates/detail_protocol.dust` | 25 |
| `templates/detail_record.dust` | 40 |
| `templates/inline_type.dust` | 34 |
| `templates/named_type.dust` | 10 |
| `templates/named_type_details.dust` | 21 |
| `templates/named_type_version.dust` | 10 |
| `templates/popover_title.dust` | 2 |
| `templates/schema_file_list.dust` | 8 |
| `templates/schema_list.dust` | 56 |
| `templates/schema_list_item.dust` | 8 |

#### 3. Rewrite `src/static_content.js`

- Replace `dust.compile` / `dust.compileFn` calls with `nunjucks.render()` / `nunjucks.configure()`.
- The `dustTemplates()` export is no longer needed (templates run server-side).
- Remove all references to `dustjs-linkedin` and `dustjs-helpers`.
- Remove `dust-core-2.7.2.js` and `dust-helpers-1.7.4.js` from `client_js` array.

**Key architectural change:** instead of embedding JSON and rendering in the browser, `inlineContent()` now renders all type detail pages to HTML strings server-side, embeds them as hidden `<section>` elements, and Vanilla JS shows/hides the right one based on the URL hash.

#### 4. Replace Sammy.js with Vanilla JS routing

Remove `vendor/sammy-0.7.6.js` from `client_js`.

Replace the `Sammy(function() { this.get(...) }).run()` block in `public/js/avrodoc.js` with a small Vanilla JS router:

```js
function handleRoute() {
  const hash = window.location.hash || '#/';
  // show the section matching the hash, hide others
  // update 'selected' class in sidebar
}
window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);
```

#### 5. Remove jQuery

Replace all `$()` / jQuery calls in `public/js/avrodoc.js` and `public/js/schema.js` with Vanilla JS equivalents:

| jQuery | Vanilla JS |
|---|---|
| `$(selector)` | `document.querySelector(selector)` |
| `$(selector).find(s)` | `el.querySelectorAll(s)` |
| `$.getJSON(url, cb)` | `fetch(url).then(r => r.json()).then(cb)` |
| `$(el).html(str)` | `el.innerHTML = str` |
| `$(el).addClass(c)` | `el.classList.add(c)` |
| `$(el).on('event', fn)` | `el.addEventListener('event', fn)` |
| `$('body').scrollTop(0)` | `document.body.scrollTop = 0` |

Remove `vendor/jquery-3.6.0.js` from `client_js`.

#### 6. Clean up vendor directory

After Phase 2, `public/vendor/` will contain only:
- `bootstrap.bundle.min.js` ✅ (added in Phase 1)
- `markdown.js` ✅ (kept)

Removed:
- `dust-core-2.7.2.js`
- `dust-helpers-1.7.4.js`
- `sammy-0.7.6.js`
- `jquery-3.6.0.js`

---

## Summary of dependency changes

| Package | Phase 1 | Phase 2 |
|---|---|---|
| `less` | ❌ Removed | — |
| `less-middleware` | ❌ Removed | — |
| `dustjs-linkedin` | (kept) | ❌ Remove |
| `dustjs-helpers` | (kept) | ❌ Remove |
| `nunjucks` | — | ✅ Add |
| Bootstrap 5 | ✅ Vendored CSS+JS | — |

Browser JS removed across both phases: Bootstrap 2 plugins, Less, DustJS, jQuery, Sammy.js.

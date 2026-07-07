# Glitchlet notes

## Overview
- Glitchlet is a browser-based HTML/CSS/JS editor with live preview, multi-file tree, project manager, and PHP publishing.
- Frontend lives in `index.html`, `assets/styles.css`, and `assets/app.js`.
- Publishing + admin dashboards live in `publish/`.

## Key UI features
- File manager: collapsible pane, rename files, add folders, drag/drop into/out of folders, delete files/folders.
- Editor: CodeMirror 5 with syntax highlighting, bracket/tag auto-close, folding + fold gutter, search dialog.
- Theme toggles: main theme auto/light/dark, editor theme light/dark, line-wrap toggle.
- Modals: reusable dialog modal replaces alerts/prompts/confirm; project metadata modal; new project modal; publish modal; account login modal.

## File tree and folders
- Folders are implemented with a hidden `.keep` marker file.
- Tree view is built from file paths; collapsible folders in `renderFileTree()`.
- Drag files into folders (drop on folder row), drag out by dropping on file tree background.
- `.keep` files are hidden and skipped when publishing.

## Publish flow (frontend)
- `publishProject()` sends a zip to `PUBLISH_ENDPOINT` with name/creator/description.
- On success, publish modal shows URL only (no per-project password).
- Import supports `.zip` and `.tgz/.tar.gz` (pako + untar-sync), and strips leading `/` from `href/src/url()`.

## Publish flow (backend)
- `publish/publish.php` validates and extracts zip, generates word-based slug, injects Remix/Admin FABs, writes `project.json`.
- Publishing requires a logged-in editor/manager account and records metadata in MySQL.

## Accounts
- Publishing requires a MySQL-backed account (editor or manager); guests can edit/preview only.
- Manager creates editor accounts (single + bulk) and sends password-set links via SMTP.
- Password reset links are stored in `password_resets` table; `/publish/reset.php` handles password set.
- Manager console supports test emails, user deletion (optionally delete projects), and project sorting.
- Project metadata now lives in MySQL (`db/schema.sql`) with `publish/bootstrap.php` for first manager.

## Admin dashboards
- Per-project admin: `projects/{slug}/admin.php` (generated from `publish/admin_template.php`), uses account auth.
- Global admin: `projects/admin.php` (generated from `publish/projects_admin_template.php`, routes to manager console).
- Global admin can archive/restore/delete projects, reset passwords, and delete users.

## Wayfinding
- Main app has a "Published Projects" button (link), "Project Manager", and Guest/Account button (Admin for managers).
- Published projects index has an Admin button (global admin) + App button.
- Global admin has Projects + App buttons.
- Individual project pages have Admin + Remix only.
- My Published Projects page supports sorting.

## Shared hosting setup
- Create a subdomain doc root for the app (not necessarily `public_html`).
- Create `/projects` inside the doc root.
- Copy `publish/config.php.template` to `publish/config.php` and configure MySQL credentials or environment variables.
- Run `db/schema.sql` to create tables.
- Use `publish/bootstrap.php` (with `GLITCHLET_BOOTSTRAP_TOKEN`) to create the first manager.
- Optional: use `/install.php` to write config, create `/projects`, run schema, and create manager (writes `install.lock`).

## Notable paths and constants
- `assets/app.js`
  - `PUBLISH_ENDPOINT` is derived from `window.location.origin` (`/publish/publish.php` on the current host).
  - `LINE_WRAP_KEY`, `THEME_STORAGE_KEY`, `EDITOR_THEME_KEY` in localStorage.
- `publish/publish.php`
  - `APP_URL` and `PROJECT_URL_BASE` for wayfinding.
  - Word lists for slug generation.

## Known gotchas
- Any hidden files in publish zip are rejected by server; `.keep` skipped on zip build.
- Per-project `admin.php` is a thin stub that requires `publish/project_admin.php`, so template changes apply everywhere. Projects published before the stub existed carry a full copy — use the manager console's "Regenerate admin pages" button once to convert them.
- `projects/admin.php` and `projects/index.html` are regenerated on publish.

## TODO ideas
- Persist folder collapse state in localStorage.
- Add folder icons in tree and rename folders.

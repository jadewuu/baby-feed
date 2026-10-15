# Offline iPhone PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Baby Feed as a free, installable iPhone PWA at `https://jadewu.online/baby-feed/` that keeps all baby and care data in IndexedDB, works offline after its first load, supports JSON backup and restore, and is linked from the existing personal site.

**Architecture:** Keep the current Next.js UI and pure record/time helpers, but replace NextAuth, Prisma, and `/api/*` calls with a typed `idb` repository. A single client provider exposes the active baby and a revision counter so reads refresh after committed writes. Next.js exports static files under `/baby-feed`; a post-build script generates a service worker from the exported asset list, and GitHub Actions deploys `out/` to Pages.

**Tech Stack:** Next.js 15 static export, React 18, TypeScript, IndexedDB via `idb`, `fake-indexeddb` for Node tests, Node test runner, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-offline-iphone-pwa-design.md`

## Assumptions

- The offline edition is allowed to delete server-only routes and dependencies on the `offline-pwa` branch because the server edition remains recoverable from repository history.
- `jadewuu/baby-feed` will be a fork of `hxhb/baby-feed`, and the deployed project path will remain `/baby-feed/`.
- `jadewuu/jadewuu.github.io` continues to own the `jadewu.online` custom domain, so its project link can target `/baby-feed/`.
- Backup restore replaces the complete local dataset after validation and explicit confirmation; it does not merge records.
- Physical iPhone acceptance requires the user to perform the final Home Screen and airplane-mode steps after deployment.

## Global Constraints

- Keep the v1 scope to one browser installation: no accounts, synchronization, API keys, webhooks, admin tools, server reminders, App Store packaging, Face ID, or encrypted backups.
- Store business data only in IndexedDB. Runtime network traffic may fetch application assets but must never send baby profiles, records, settings, or backups.
- Give every entity a stable `crypto.randomUUID()` identifier and ISO `createdAt`/`updatedAt` timestamps. Preserve event timestamps separately.
- Report a write as successful only after its IndexedDB transaction completes. On failure, keep the form or draft available for retry.
- Upgrade IndexedDB in place. Never delete the database in an upgrade path.
- Validate an entire backup, including baby references and tooth uniqueness, before opening the replacement transaction. Abort the transaction on any write error.
- Scope the manifest and service worker to `/baby-feed/`. Cache exported HTML, scripts, styles, fonts, icons, and the manifest only; do not copy IndexedDB values into Cache Storage.
- Keep server-only modules out of client imports and out of the final static build.
- Make surgical changes. Reuse existing validation, display, Beijing-time, vaccine, tooth, and growth helpers where they are already pure.

## Review Focus

1. IndexedDB upgrades preserve existing records and settings.
2. Cross-midnight sleep appears on both relevant Beijing calendar days and contributes the correct duration to each day.
3. Invalid or incompatible backups, including broken baby references and duplicate teeth, leave all entity and settings snapshots unchanged.
4. Every route, icon, manifest URL, service-worker URL, and cached navigation works below `/baby-feed/`, including an offline deep-link relaunch.
5. Quota and transaction failures never show success and never erase an in-progress form.

---

### Task 1: Establish the static-export and local-test foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.mjs`
- Create: `lib/base-path.ts`
- Create: `tests/offline-static-config.test.mjs`

**Interfaces:**

```ts
export const BASE_PATH = '/baby-feed'
export function withBasePath(path: string): string
```

- [ ] Write `tests/offline-static-config.test.mjs` to assert `output: 'export'`, `basePath: '/baby-feed'`, `trailingSlash: true`, unoptimized images, and base-path handling for `/`, icons, the manifest, and the service worker.
- [ ] Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/offline-static-config.test.mjs` and verify it fails because the export settings and helper do not exist.
- [ ] Add runtime dependency `idb` and development dependency `fake-indexeddb` with `npm install idb && npm install -D fake-indexeddb`; keep Prisma/Auth packages temporarily so intermediate type checks remain possible.
- [ ] Change `next.config.mjs` to a static export with `/baby-feed` as `basePath`, `trailingSlash: true`, and `images.unoptimized: true`; remove standalone-only response-header and server-action configuration.
- [ ] Add the minimal `withBasePath` helper, normalizing only leading slashes and the root path.
- [ ] Run the focused test and `npx tsc --noEmit`; verify both pass.
- [ ] Commit: `build: prepare offline static export`

### Task 2: Create the versioned IndexedDB schema and baby/settings repository

**Files:**
- Create: `lib/local-store/schema.ts`
- Create: `lib/local-store/db.ts`
- Create: `lib/local-store/babies.ts`
- Create: `lib/local-store/settings.ts`
- Create: `tests/local-store-schema.test.mjs`
- Create: `tests/local-store-babies.test.mjs`

**Interfaces:**

```ts
export interface LocalBaby {
  id: string
  name: string
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  createdAt: string
  updatedAt: string
}

export interface LocalSettings {
  activeBabyId: string | null
  quickRecordKeys: QuickRecordKey[]
}

export function openBabyFeedDb(): Promise<IDBPDatabase<BabyFeedDb>>
export function listBabies(): Promise<LocalBaby[]>
export function createBaby(input: BabyInput): Promise<LocalBaby>
export function updateBaby(id: string, input: BabyInput): Promise<LocalBaby>
export function deleteBaby(id: string): Promise<void>
export function getSettings(): Promise<LocalSettings>
export function setActiveBabyId(id: string | null): Promise<void>
export function setQuickRecordKeys(keys: QuickRecordKey[]): Promise<void>
```

- [ ] Write schema tests using `fake-indexeddb` for a fresh database and a seeded version-1 database upgraded to production schema version 2. Assert all seed rows survive and expected compound indexes exist.
- [ ] Write baby/settings tests for UUID/timestamp creation, deterministic ordering, edit timestamps, active-baby persistence, quick-record normalization, and selecting the next remaining baby after deletion.
- [ ] Add a failed-transaction test that rejects without changing the prior baby/settings snapshot.
- [ ] Run the two focused test files and verify they fail because the local store does not exist.
- [ ] Define typed stores for metadata, babies, feeding records, health records, tooth eruptions, memos, and settings. Start the production database at version 2 with an explicit version-1 baseline migration so preservation is exercised from the first release. Use indexable strings/numbers only; represent memo completion in indexes as `'pending' | 'completed'` while retaining the boolean domain field.
- [ ] Implement one cached database opener with versioned upgrade callbacks. Export a test-only close/reset hook that closes handles without deleting data during production upgrades.
- [ ] Implement baby CRUD and settings writes in transactions. Baby deletion must remove that baby's feeding, health, tooth, and memo rows and update `activeBabyId` atomically.
- [ ] Run both focused tests, the full `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `feat: add local baby and settings storage`

### Task 3: Implement atomic care-record and memo persistence

**Files:**
- Create: `lib/local-store/records.ts`
- Create: `lib/local-store/memos.ts`
- Create: `tests/local-store-records.test.mjs`
- Create: `tests/local-store-memos.test.mjs`

**Interfaces:**

```ts
export function createFeedingRecord(input: FeedingRecordInput): Promise<LocalFeedingRecord>
export function updateFeedingRecord(id: string, babyId: string, patch: FeedingRecordInput): Promise<LocalFeedingRecord>
export function deleteFeedingRecord(id: string, babyId: string): Promise<void>
export function createHealthRecord(input: HealthRecordInput): Promise<LocalHealthRecord>
export function updateHealthRecord(id: string, babyId: string, patch: HealthRecordInput): Promise<LocalHealthRecord>
export function deleteHealthRecord(id: string, babyId: string): Promise<void>
export function listHealthHistory(babyId: string, type: HealthType): Promise<LocalHealthRecord[]>
export function createMemo(input: MemoInput): Promise<LocalMemo>
export function updateMemo(id: string, babyId: string, patch: MemoPatch): Promise<LocalMemo>
export function deleteMemo(id: string, babyId: string): Promise<void>
```

- [ ] Write feeding CRUD tests for all four feeding types, baby isolation, event-time ordering, stable IDs, and `updatedAt` changes.
- [ ] Write health CRUD tests for every current health type and history lookup, including sleep fields, vaccine dose fields, supplement flags, and custom records.
- [ ] Write tooth tests asserting health and tooth rows commit together, one tooth code cannot belong to two records for the same baby, edits replace the selected tooth set, and delete removes related tooth rows.
- [ ] Write memo tests for create/edit/complete/reopen/delete and the baby/completion/scheduled-time index ordering.
- [ ] Add write-failure tests that abort the whole tooth or memo transaction and preserve the previous snapshot.
- [ ] Run the focused tests and verify they fail because the repositories do not exist.
- [ ] Implement the record repositories with existing payload validation helpers where applicable. Verify the referenced baby before writes and use one transaction for every multi-store mutation.
- [ ] Convert constraint, quota, and transaction failures into user-facing `LocalStoreError` values without reporting success early.
- [ ] Run the focused tests, full `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `feat: persist care records locally`

### Task 4: Build local dashboard, timeline, and statistics projections

**Files:**
- Create: `lib/local-store/view-models.ts`
- Create: `lib/local-store/queries.ts`
- Modify: `lib/api-helpers.ts`
- Create: `tests/local-store-queries.test.mjs`

**Interfaces:**

```ts
export function getDashboardSnapshot(babyId: string, now?: Date): Promise<DashboardSnapshot>
export function getTimelineDay(babyId: string, date: string): Promise<TimelineRecord[]>
export function listTimelineDates(babyId: string): Promise<string[]>
export function getStatsSnapshot(babyId: string, range: StatsRange): Promise<StatsSnapshot | null>
```

- [ ] Write dashboard projection tests for today's feeds/health values, latest measurements, quick records, and the three-day memo window.
- [ ] Write timeline tests for sort order, valid-date discovery, baby isolation, and a sleep spanning 23:30–01:30 Beijing time appearing on both dates with the correct display time.
- [ ] Write statistics tests for preset and custom date ranges, milk totals, feeding intervals/heatmap, diaper and supplement counts, growth trends, vaccines, teeth, medications, and memos.
- [ ] Add explicit duration assertions that a cross-midnight sleep contributes 30 minutes to each Beijing date rather than 60 minutes to one date.
- [ ] Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/local-store-queries.test.mjs` and verify it fails.
- [ ] Move or duplicate only the pure Beijing day-range and sleep-splitting helpers needed by client code out of server-coupled imports.
- [ ] Implement indexed range reads and pure projection functions using the view-model shapes already consumed by `Dashboard`, `Timeline`, and `Stats`.
- [ ] Run the focused tests, existing time tests, full `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `feat: query local dashboard timeline and stats`

### Task 5: Add validated atomic backup, restore, and clear-data operations

**Files:**
- Create: `lib/local-store/backup.ts`
- Create: `tests/local-store-backup.test.mjs`

**Interfaces:**

```ts
export interface BabyFeedBackup {
  format: 'baby-feed-backup'
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export function exportBackup(): Promise<BabyFeedBackup>
export function validateBackup(value: unknown): ValidatedBackup
export function restoreBackup(backup: ValidatedBackup): Promise<RestoreSummary>
export function clearAllData(): Promise<void>
```

- [ ] Write a full round-trip test containing multiple babies and every entity type; compare normalized exports before and after restore.
- [ ] Write rejection tests for malformed JSON-shaped input, unknown/newer versions, duplicate IDs, invalid timestamps/types, missing baby references, inconsistent active baby, duplicate tooth codes, and tooth records pointing at non-tooth health records.
- [ ] For each invalid case, seed sentinel data, attempt restore, and assert normalized exports excluding `exportedAt` are identical before and after.
- [ ] Write a forced mid-restore transaction failure test and assert the original database remains unchanged.
- [ ] Write clear-data tests that remove every entity and return the app to an empty settings state.
- [ ] Run the focused test and verify it fails because backup operations do not exist.
- [ ] Implement pure validation before mutation, then replace all stores in one read-write transaction. Return a count summary for the confirmation UI.
- [ ] Run the focused test, full `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `feat: add local backup and restore`

### Task 6: Introduce the local-data provider and first-run setup

**Files:**
- Create: `components/LocalDataProvider.tsx`
- Create: `components/FirstRunSetup.tsx`
- Modify: `components/Providers.tsx`
- Modify: `components/Navbar.tsx`
- Modify: `app/layout.tsx`
- Create: `tests/offline-shell.test.mjs`

**Interfaces:**

```ts
interface LocalDataContextValue {
  status: 'loading' | 'needs-setup' | 'ready' | 'error'
  babies: LocalBaby[]
  activeBabyId: string | null
  revision: number
  refresh(): Promise<void>
  commit<T>(write: () => Promise<T>): Promise<T>
  selectBaby(id: string): Promise<void>
}

export function useLocalData(): LocalDataContextValue
```

- [ ] Add shell tests that reject imports from `next-auth`, `lib/auth`, `next/headers`, and `next/server` in layout/providers/navbar and assert there is a local-only first-run message.
- [ ] Run the shell test and verify it fails on the current authenticated shell.
- [ ] Implement the provider boot sequence: open IndexedDB, load babies/settings, repair an invalid active ID, expose errors distinctly from an empty database, and increment `revision` only after a committed write.
- [ ] Implement first-run baby creation with name, birth date, and gender. Explain on-device storage before submission and keep entered values after a failed save.
- [ ] Replace `SessionProvider` with `LocalDataProvider`; render the application and navbar only after setup, and show retryable loading/error states.
- [ ] Remove account-dependent navbar logic and sign-out controls while preserving current desktop/mobile navigation and composer behavior.
- [ ] Make layout metadata, splash assets, manifest URL, and service-worker registration use `/baby-feed`; defer update prompting to Task 11.
- [ ] Run the shell test, `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `feat: add local first-run shell`

### Task 7: Route every record write through the local repository

**Files:**
- Modify: `components/RecordComposerProvider.tsx`
- Modify: `components/record-composer/RecordComposerEditor.tsx`
- Modify: `components/FeedingForm.tsx`
- Modify: `components/HealthForm.tsx`
- Modify: `components/HealthRecordFields.tsx`
- Modify: `components/ToothEruptionFields.tsx`
- Modify: `components/ToothGrowthStats.tsx`
- Modify: `components/TimelineEditRecordModal.tsx`
- Create: `tests/offline-record-writes.test.mjs`

**Interfaces:** Use the Task 3 record/memo functions through `LocalDataContextValue.commit`; do not introduce a second data-client abstraction.

- [ ] Write a static boundary test asserting these active components contain no `/api/`, `fetch(`, NextAuth, or request-cache imports and use local repository calls instead.
- [ ] Run the focused test and verify it fails on the current API calls.
- [ ] Load baby options and the active baby from `useLocalData` in the composer and legacy forms.
- [ ] Replace composer/form POST calls with `createFeedingRecord`, `createHealthRecord`, or `createMemo`; call the provider's `commit` wrapper only around the actual repository promise.
- [ ] Replace timeline/tooth update and delete calls with their local repository equivalents, including vaccine-history and tooth-history lookups.
- [ ] Keep timers and unsaved drafts in browser storage, but remove user-ID namespacing now that the app has one local owner.
- [ ] Preserve form values and show the existing inline error UI on any rejected local write; clear drafts and show success only after commit.
- [ ] Run the focused test, local-store tests, full `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `refactor: save records through indexeddb`

### Task 8: Migrate dashboard, timeline, and statistics reads

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/timeline/page.tsx`
- Modify: `app/timeline/TimelinePageClient.tsx`
- Modify: `app/stats/page.tsx`
- Modify: `app/stats/StatsPageClient.tsx`
- Modify: `components/Dashboard.tsx`
- Modify: `components/Timeline.tsx`
- Modify: `components/Stats.tsx`
- Modify: `components/MemoSection.tsx`
- Create: `tests/offline-page-reads.test.mjs`

**Interfaces:** Use `getDashboardSnapshot`, `getTimelineDay`, `listTimelineDates`, and `getStatsSnapshot` from Task 4; components receive no server preload props.

- [ ] Write a boundary test asserting all four static pages and active read components avoid server preload modules, request caches, and `/api/` fetches.
- [ ] Run the focused test and verify it fails on the existing server and API imports.
- [ ] Make each page a static wrapper around its client component; remove server-provided initial props.
- [ ] Load dashboard snapshots on active baby/revision/day changes, and keep read errors separate from legitimate empty states.
- [ ] Load timeline days and valid dates from local queries; retain stale-request protection when the user switches baby/date quickly.
- [ ] Load statistics from local queries for preset and custom ranges; preserve Recharts' client-only loading behavior.
- [ ] Replace memo create/edit/complete/reopen/delete calls with local repository operations and provider commits.
- [ ] Ensure successful edits, deletes, and memo changes increment the revision once and refresh every affected screen.
- [ ] Run the focused test, query tests, full `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `refactor: read app views from indexeddb`

### Task 9: Convert settings to local baby, quick-record, and data controls

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `app/settings/quick-records/page.tsx`
- Modify: `components/Settings.tsx`
- Modify: `components/QuickRecordSettings.tsx`
- Create: `components/LocalDataSettings.tsx`
- Create: `tests/offline-settings.test.mjs`

**Interfaces:**

```ts
export function parseBackupText(text: string): ValidatedBackup
```

- [ ] Write a boundary test asserting settings contain no account/password/admin/logout/API calls and expose baby CRUD, active-baby selection, export, restore, and clear controls.
- [ ] Add pure parsing tests showing malformed/invalid backup text is rejected before `restoreBackup` can be called; verify valid text returns the counts needed by the confirmation UI.
- [ ] Run the focused test and verify it fails on current account/API behavior.
- [ ] Convert settings pages to static client pages and wire baby add/edit/delete/selection to the provider and repositories.
- [ ] Persist quick-record order locally and reuse `normalizeQuickRecordKeys` and the current drag/keyboard UI.
- [ ] Add JSON download with a date-stamped filename, file selection and validation summary, explicit restore confirmation, and success/error feedback.
- [ ] Add a sensitive-data warning plus a regular-backup recommendation. Add explicit clear-all confirmation and return to first-run only after the clear transaction commits.
- [ ] Remove account name, email, password, admin, API key, webhook, reminder, server-version, and logout sections from the active settings UI.
- [ ] Run the focused test, backup tests, full `npm test`, and `npx tsc --noEmit`; verify they pass.
- [ ] Commit: `feat: add offline data settings`

### Task 10: Remove server-only surfaces and make static export pass

**Files:**
- Delete: `app/api/`
- Delete: `app/login/`
- Delete: `app/register/`
- Delete: `app/admin/`
- Delete: `app/settings/api-keys/`
- Delete: `app/settings/reminders/`
- Delete: `app/settings/webhooks/`
- Delete: `middleware.ts`
- Delete: `instrumentation.ts`
- Delete: server-only unused components and `lib/server-*.ts`, auth, Prisma, webhook, reminder, rate-limit, invite, and admin modules after confirming zero imports
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Create: `tests/offline-runtime-boundary.test.mjs`

**Interfaces:** No new runtime interface. The deliverable is a static route tree with no server entry points.

- [ ] Write a boundary test that fails if `app/api`, auth pages, middleware, Prisma/Auth runtime dependencies, or active server-only imports remain.
- [ ] Run it and verify it fails against the current tree.
- [ ] Use `rg` to prove each server-only file/component has no remaining active import, then delete only those files and routes.
- [ ] Remove Prisma, libsql, NextAuth, bcrypt, fetch polyfills, database scripts, and their generated artifacts/configuration from the offline branch's package/config surface.
- [ ] Update README with the offline-local privacy model, development URL (`/baby-feed/`), build/test commands, backup warning, and Pages URL.
- [ ] Run `npm test`, `npx tsc --noEmit`, and `npm run build`; verify `out/index.html`, `out/timeline/index.html`, `out/stats/index.html`, and `out/settings/index.html` exist.
- [ ] Search `out/` for `/api/`, `next-auth`, Prisma client markers, `localhost`, and absolute asset URLs missing `/baby-feed`; resolve every active hit.
- [ ] Commit: `refactor: remove server runtime from offline build`

### Task 11: Generate the offline service worker and update prompt

**Files:**
- Modify: `public/manifest.json`
- Delete: `public/sw.js`
- Create: `scripts/sw-template.js`
- Create: `scripts/generate-sw.mjs`
- Create: `components/ServiceWorkerManager.tsx`
- Modify: `components/Providers.tsx`
- Modify: `package.json`
- Create: `tests/service-worker.test.mjs`

**Interfaces:**

```ts
export function generateServiceWorker(options: { outDir: string; basePath: string }): Promise<void>
```

- [ ] Write generator tests against a temporary sample `out/`: assert versioned cache naming, base-path scope, exported route and asset precaching, same-origin restriction, navigation fallback, `SKIP_WAITING` handling, and exclusion of source maps or unexpected files.
- [ ] Add assertions that the manifest's `start_url`, `scope`, and icons all begin with `/baby-feed/` and that generated code contains no IndexedDB reads or business-data serialization.
- [ ] Run the focused test and verify it fails because the generator and scoped manifest do not exist.
- [ ] Update the manifest to install and launch at `/baby-feed/` in standalone portrait mode.
- [ ] Generate `out/sw.js` after `next build` by walking the exported directory in stable order and hashing the asset list/content into the cache name. Precache exported HTML and static assets only.
- [ ] Implement cache-first same-origin assets and cached navigation fallback. Leave a newly installed worker waiting until the UI sends `SKIP_WAITING`; claim clients on activation without touching IndexedDB.
- [ ] Add a manager that registers `/baby-feed/sw.js`, detects `waiting`/`updatefound`, shows an update prompt, sends `SKIP_WAITING` on acceptance, and reloads once on `controllerchange`.
- [ ] Run the focused test, full `npm test`, `npx tsc --noEmit`, and `npm run build`; verify generated `out/sw.js` includes all exported route HTML and hashed Next assets.
- [ ] Serve `out/` under a local `/baby-feed/` path, load each route once, disable the network, and verify root plus direct `/timeline/`, `/stats/`, and `/settings/` navigation still render.
- [ ] Commit: `feat: add offline install and updates`

### Task 12: Add GitHub Pages deployment and publish the fork

**Files:**
- Create: `.github/workflows/pages.yml`
- Create: `tests/pages-workflow.test.mjs`
- Modify local Git remotes after the repository fork exists

**Interfaces:** The workflow exposes one `build` job artifact named `github-pages` and one `deploy` job targeting the `github-pages` environment.

- [ ] Write a workflow test that requires locked dependency installation, tests, typecheck, static build, Pages artifact upload from `out/`, least-privilege Pages permissions, and deploy concurrency.
- [ ] Run it and verify it fails because the workflow does not exist.
- [ ] Add the Pages workflow triggered by `offline-pwa` pushes and manual dispatch, using current supported official Pages actions.
- [ ] Run `npm test`, `npx tsc --noEmit`, and a clean `npm ci && npm run build`; verify the local `out/` artifact.
- [ ] Check `gh auth status` and `gh repo view jadewuu/baby-feed`; create the fork with `gh repo fork hxhb/baby-feed --clone=false` only if absent.
- [ ] Commit: `ci: deploy offline app to github pages`
- [ ] Add an HTTPS `fork` remote for `https://github.com/jadewuu/baby-feed.git` without changing the read-only upstream `origin`, then push `offline-pwa`.
- [ ] Configure the fork's Pages build type as GitHub Actions through `gh api`, trigger or observe the workflow, and wait for a successful deployment.
- [ ] Verify with HTTP requests that `https://jadewu.online/baby-feed/`, its manifest, icons, route HTML, Next assets, and service worker return 200 and use the expected scope/content types.
- [ ] Open the deployed app in a browser, create representative records, reload, and verify IndexedDB persistence and zero business-data requests in the network log.

### Task 13: Link the deployed app from the personal site

**Files:**
- Modify in `jadewuu/jadewuu.github.io`: `index.html`
- Modify only an existing stylesheet in that repository if the current project-card pattern requires it

**Interfaces:** One public anchor targets `https://jadewu.online/baby-feed/` and follows the site's existing project-card markup.

- [ ] Pull a fresh copy of `jadewuu/jadewuu.github.io` and inspect its current project-card markup and deployment status.
- [ ] Add one Baby Feed entry using the existing visual pattern, a concise local-only/offline description, and an absolute link to `https://jadewu.online/baby-feed/`.
- [ ] Serve the site locally and verify the card at desktop and mobile widths, keyboard focus, and the exact target URL.
- [ ] Commit in the personal-site repository: `feat: link Baby Feed offline app`
- [ ] Push the site's current publishing branch and wait for Pages deployment.
- [ ] Verify the public home page links to the live app and that the link does not redirect to login or registration.

### Task 14: Run release verification and hand off iPhone acceptance

**Files:**
- Modify: `README.md` only if verification reveals a missing user instruction
- Create: `docs/offline-iphone-acceptance.md`

**Interfaces:** The acceptance document is a checkbox runbook for the published URL and records the tested app version/date.

- [ ] Run the complete clean verification: `npm ci`, `npm test`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Review `git diff` and `rg` results to confirm no application runtime fetch can send business data and no server-only screen is linked.
- [ ] In a clean browser profile, verify first run, every record category, edit/delete, baby switching, timeline/stat refresh, memo completion, quick settings, reload persistence, export, invalid restore rejection, valid restore, and clear-data return to onboarding.
- [ ] Simulate a service-worker update with data already present; apply the prompt and verify all IndexedDB rows remain.
- [ ] Record the physical iPhone checklist in `docs/offline-iphone-acceptance.md`: Safari open, Add to Home Screen, representative records, airplane-mode relaunch, timeline/stats checks, backup-clear-restore, reconnect-update-retain-data.
- [ ] Commit: `docs: add iphone acceptance checklist`
- [ ] Ask the user to run the physical-iPhone checklist. Capture any failed step as a reproducible issue, fix it test-first, redeploy, and repeat until all steps pass.

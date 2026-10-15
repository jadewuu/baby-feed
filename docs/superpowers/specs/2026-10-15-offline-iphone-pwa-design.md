# Offline iPhone PWA Design

**Status:** Approved in conversation on 2026-10-15

## Purpose

Create a free, single-device edition of Baby Feed that runs as an installable iPhone PWA without a Mac, application server, account, or cloud database. The application must remain useful offline, keep all family data on the iPhone, and publish from GitHub Pages at `https://jadewu.online/baby-feed/`.

The existing server edition remains available in repository history. The offline edition is developed on an `offline-pwa` branch in a fork under the `jadewuu` GitHub account because the available GitHub identities do not have push access to `hxhb/baby-feed`.

## Goals

- Install from Safari to the iPhone Home Screen and launch in standalone mode.
- Work after the initial load without a network connection.
- Store baby profiles and care records only in the browser's local IndexedDB database.
- Preserve the core Baby Feed workflows and visual language.
- Provide explicit backup, restore, and clear-data controls.
- Publish automatically through GitHub Actions and link the application from `jadewu.online`.
- Keep stable record identifiers and timestamps so a later synchronization feature can migrate existing data.

## Non-goals

The first offline release does not include:

- accounts, registration, login, roles, invitations, or multi-user access;
- automatic synchronization between devices;
- API keys, public HTTP APIs, webhooks, or administration pages;
- reliable background reminders while the PWA is closed;
- an App Store or TestFlight build;
- application-level Face ID, passcode, or encrypted backup files.

## User-facing scope

The offline release keeps:

- baby profile creation, editing, deletion, and active-baby selection;
- breastfeeding, bottled breast milk, formula, solid food, sleep, diaper, supplement, growth, temperature, vaccine, medication, tooth, and custom health records;
- the dashboard, record composer, timeline, statistics, and growth views;
- memos and quick-record settings;
- local data export, restore, and complete deletion.

Login, registration, admin, API key, webhook, server reminder, and server update-check screens are removed from navigation and the static build.

## Architecture

### Static application

The offline branch uses Next.js static export with a `/baby-feed` base path and trailing-slash-compatible routes. Pages that currently read sessions or server data become client-rendered static pages. Middleware and server API routes are excluded from the offline application.

GitHub Actions builds the static export and publishes it as a project Pages site. The existing `jadewuu/jadewuu.github.io` site remains the root site for `jadewu.online` and gains one Baby Feed project entry that links to `/baby-feed/`.

### Local data module

A dedicated local data module owns all IndexedDB access. UI components call typed functions in this module instead of calling `/api/*`. The service worker does not intercept or emulate API requests.

The module is split by responsibility:

- database opening, version upgrades, and transactions;
- baby and settings operations;
- feeding, health, tooth, and memo operations;
- timeline and statistics queries;
- backup export, validation, restore, and clear-data operations.

Existing pure formatting, validation, time, vaccine-progress, tooth, and statistics helpers are reused where they do not depend on Prisma or Next.js server APIs. Server-only code is not imported into the client bundle.

### UI refresh flow

The application has one local-data provider that tracks the active baby and a data revision. A successful write increments the revision. Dashboard, timeline, and statistics queries rerun when their relevant baby, date range, or revision changes. Writes only report success after the IndexedDB transaction commits.

## Local data model

IndexedDB stores the following logical entities:

- application metadata and schema version;
- baby profiles and the active baby identifier;
- feeding records;
- health records;
- tooth eruption records;
- memos;
- quick-record settings.

Business fields follow the existing Prisma models so the current forms and display logic can be reused. Server ownership fields such as `createdBy` and user relations are omitted. Each domain record has a stable UUID, `createdAt`, and `updatedAt`; care records also retain their actual event timestamps.

Indexes support the queries used by the application:

- records by baby and event time;
- health records by baby, type, and event time;
- memos by baby, completion state, and scheduled time;
- tooth records by baby and tooth code.

IndexedDB upgrades are versioned and run in upgrade transactions. An application update must migrate existing stores in place and must never delete a database merely because the schema version changed.

## First-run flow

The first launch shows a short local-only explanation and a baby profile form. After the first baby is created, the application opens the dashboard. Returning launches restore the active baby and open the dashboard directly.

No email, password, or remote account is requested.

## Backup and restore

Export produces one JSON file containing:

- a format identifier;
- backup schema version;
- export timestamp;
- application metadata and every supported local entity.

Restore reads the selected file, parses it without mutating current data, validates its format, schema version, required fields, identifiers, timestamps, and cross-record baby references, and displays a summary. After user confirmation, one IndexedDB transaction replaces the current local dataset. Any parsing, validation, or write failure aborts the transaction and leaves existing data unchanged.

Clear-data requires explicit confirmation and removes all local entities before returning to first-run setup.

The settings screen explains that uninstalling the PWA or clearing Safari website data can remove IndexedDB data and recommends regular exports. Backup files are readable JSON and may contain sensitive family information.

## Offline and update behavior

The service worker is scoped to `/baby-feed/` and precaches the application shell, fonts, icons, and static route assets. Navigation and static assets use cached responses when offline. User records are never copied into Cache Storage.

When a new application version is available, the running PWA shows an update prompt. Applying the update activates the new service worker and reloads the application without clearing IndexedDB.

All URLs in the manifest, metadata, icons, and service worker respect the project base path. The installed application opens at `/baby-feed/` in standalone portrait mode.

## Error handling

- Failed local writes show a visible error and leave the form data available for retry.
- Read failures show an error state instead of an empty-data state.
- Invalid backups report the validation problem and do not modify IndexedDB.
- Storage quota and transaction failures recommend exporting available data and freeing device storage.
- Unsupported or newer backup versions are rejected rather than partially imported.
- The application never displays a successful-save message before transaction completion.

## Privacy and security

Application code and assets are public on GitHub Pages. Each browser installation creates an independent local database, and no personal record is committed to GitHub or sent to the Pages host.

The first release relies on the iPhone lock screen and Safari's origin isolation. Anyone who can unlock the phone and open the PWA can read its records. Exported JSON is not encrypted by the application.

The offline build removes analytics, version checks, webhooks, API clients, authentication calls, and other runtime requests unrelated to loading application assets.

## Future synchronization boundary

Synchronization is intentionally absent from this release. Stable UUIDs, existing event timestamps, and `createdAt`/`updatedAt` fields are retained so a later iteration can add remote change exchange without replacing the local schema or rewriting saved records. Conflict rules, deletion tombstones, accounts, and remote storage are deferred until synchronization is designed.

## Deployment

1. Fork `hxhb/baby-feed` to the `jadewuu` account.
2. Push the `offline-pwa` branch to the fork.
3. Add a GitHub Actions Pages workflow that installs locked dependencies, runs verification, builds the static export, and deploys the generated directory.
4. Enable GitHub Pages through GitHub Actions for the fork.
5. Verify `https://jadewu.online/baby-feed/` and its manifest, service worker scope, icons, and static assets.
6. Add a Baby Feed project card and application link to `jadewuu/jadewuu.github.io`.

No deployment secret contains user data. The workflow receives only the standard GitHub Pages permissions needed to publish the static artifact.

## Verification

Automated checks cover:

- IndexedDB schema creation and upgrades;
- create, read, update, and delete behavior for each local entity;
- active-baby switching and record isolation;
- timeline, day summary, and statistics calculations;
- successful backup round trips;
- invalid and incompatible backup rejection without mutation;
- static export completion;
- generated paths and assets under `/baby-feed/`;
- service worker caching and update behavior.

Browser verification covers first-run setup, every record category, edits and deletion, timeline and statistics refresh, backup export and restore, reload persistence, and offline relaunch.

Final acceptance uses a physical iPhone:

1. Open the Pages URL in Safari.
2. Add the application to the Home Screen.
3. Create a baby and representative records.
4. Enable airplane mode and relaunch the installed PWA.
5. Confirm records, timeline, and statistics remain available.
6. Export a backup, clear local data, restore the backup, and confirm the records return.
7. Reconnect, deploy a new application version, update the PWA, and confirm local records remain intact.

## Success criteria

The work is complete when the published PWA installs and passes the physical-iPhone acceptance flow, the application makes no business-data network requests, local data survives normal reloads and application updates, backup recovery succeeds, and `jadewu.online` links to the working application.

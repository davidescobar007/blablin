# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A client-side React SPA for **bulk creating/editing PocketBase records**. The user connects to any PocketBase instance, picks a collection, and edits many records at once in a dynamic grid whose columns/inputs adapt to the collection schema. Optional Google Gemini integration generates cell content/images per column. Everything runs in the browser — there is no backend of our own; PocketBase + Gemini are called directly from the client.

## Commands

```bash
npm run dev       # Vite dev server with HMR
npm run build     # tsc -b (typecheck) THEN vite build — build fails on any type error
npm run lint      # ESLint (flat config, eslint.config.js)
npm run preview   # serve the production build
```

There is **no test runner** configured — don't suggest `npm test`. Type errors surface only via `npm run build` (or your editor); `npm run dev` does not typecheck.

## Stack

React 19 · TypeScript (strict, `noUnusedLocals`/`noUnusedParameters` on) · Vite 7 · Tailwind CSS **v4** (via `@tailwindcss/postcss`, `@tailwindcss/typography`) · `@tanstack/react-table` · `pocketbase` SDK · `@google/genai` (Gemini) · `lucide-react` icons. Class merging via `cn()` in `src/lib/utils.ts` (clsx + tailwind-merge). No path aliases — all imports are relative.

## Architecture

### Single global context holds all app state
`src/context/PocketBaseContext.tsx` is one large provider that owns connection, collection list, the loaded records, the change-tracking model, save logic, and AI config. Consume it everywhere via the `usePocketBase()` hook (`src/context/usePocketBase.ts`). There is no other store. (The refactor docs propose splitting this into PocketBase/Records/AI contexts — not done yet.)

### Change-tracking model (the core data structure)
Records are wrapped as `TrackedRecord { id, data, originalData, state, changes, error? }` where `state` is `"original" | "modified" | "new" | "saved" | "error"`. `updateCell` diffs against `data` and flips state to `modified`/`new`, recording per-field `changes`. `getRecordsForSave()` derives create/update payloads (new rows omit the temp `new_N` id; modified rows send only changed fields; `File` values switch the payload to `FormData`). `saveAllChanges()` runs creates then updates **sequentially**, marking each row `saved` or `error` so failures are isolated per row, then refreshes if all succeeded.

### ⚠️ Component duplication — know which copy is LIVE before editing
There are **three generations** of UI components in `src/components/`. Only some are wired into the app. `App.tsx` is the source of truth for what's live:

- **Live entry points:** `organisms/ConnectionForm`, `organisms/RecordsTable`, and top-level `components/CollectionSelector`.
- **`organisms/RecordsTable/RecordsTable.tsx`** is the real records UI. It composes most building blocks from **`components/records-table/*`** (MasterDetailView, BulkTableView, DetailPanel, the dialogs, and the `hooks/`), plus top-level `components/AISettingsDialog` and `components/AIColumnConfigDialog`.
- **Dead/superseded — do not edit these expecting changes to appear:** `components/RecordsTable.tsx` (+ `.bak`), `components/ConnectionForm.tsx`, and `components/records-table/RecordsTable.tsx` (an older standalone version replaced by the organisms one; its *sibling* files in `records-table/` are still live).

When a change "isn't showing up," you're almost certainly editing a dead copy. Trace the import chain from `App.tsx` first.

### Duplicated type definitions
Core types (`TrackedRecord`, `RowState`, `AIColumnConfig`, `PocketBaseContextType`) exist in **both** `src/context/PocketBaseContext.tsx` and `src/types/pocketbase.types.ts`; `Column` exists in both `src/types/records.types.ts` and `src/components/records-table/types.ts`. The `records-table/*` files import from `context/PocketBaseContext`; `organisms/*` and `types/records.types.ts` import from `types/`. Keep both copies in sync when changing a shape, or you'll get mismatched-type errors at build.

### PocketBase schema/fields compatibility shim
PocketBase renamed a collection's field list from `schema` to `fields` (~v0.22+). The codebase reads `collection.schema || collection.fields || []` in many places (`getDisplayColumns`, `addNewRows`, dialog props). Preserve this fallback whenever you touch schema-reading code. `getDisplayColumns()` in `src/utils/formatters.ts` is the canonical schema→`Column[]` translator (prepends a synthetic `id` column, resolves relation `collectionId`, normalizes select `values`).

### View modes
`TableMode = "browse" | "individual" | "bulk"`, persisted in localStorage key `records-table-mode` (via the `useTableMode` hook). `browse`/`individual` render `MasterDetailView` + `DetailPanel` (record list + editable detail); `bulk` renders `BulkTableView` (full spreadsheet grid). On mobile (`useViewport`), `bulk` is hidden and coerced to `browse`.

### AI generation
`src/context/useAI.ts` exports `generateAIContent` (text) and `generateAIImage` (image → converted to WebP via `utils/imageConversion.ts`) using `@google/genai`. Prompts use `{variable}` templating with **dot-notation for nested values** (`{user.address.city}`) and will `JSON.parse` string fields to resolve nested paths. Per-column config is `AIColumnConfig { defaultPrompt, defaultVariableColumns, formatInstructions?, model?, generateImage?, conditionalRules? }`; `conditionalRules` let the prompt/variables change based on a field value (operators `eq/neq/gt/gte/lt/lte/contains/not_contains/startsWith`).

### Persistence & auth
Only AI data is persisted to localStorage: `pocketbase-ai-api-key` and `pocketbase-ai-configs` (the provider runs a one-time migration from the old `{prompt}` shape to `{defaultPrompt}` on load). **PocketBase credentials are kept in memory only** and never stored. Two auth paths: admin email/password (`connect`) and API token (`connectWithToken`). Both normalize the URL by stripping trailing slashes, a `/_/...` proxy path, and a trailing `/api`.

## Notes

- The context and `useAI.ts` are heavily `console.log`-instrumented (connection flow, AI prompt resolution, save/import progress). This is intentional debug output.
- Code comments and the `*.md` planning docs (`REFACTOR_*`, `PREVIEW_IMPLEMENTATION`, `*_FIX.md`, `prd_*`) are largely in Spanish; UI strings are mixed English/Spanish.
- `.kilocode/` holds a `frontend-design` skill and a context7 MCP config — these are tooling for other AI assistants, not app code.

# CrateDigger

A personal MP3 downloader — paste a Spotify or YouTube link and get an MP3 file directly in your browser.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/mp3-downloader run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Frontend: React + Vite + Tailwind (shadcn/ui)
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Python: yt-dlp (YouTube), spotdl (Spotify), ffmpeg for audio conversion

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `artifacts/api-server/src/routes/download.ts` — download job logic
- `artifacts/mp3-downloader/src/pages/home.tsx` — main UI page
- `artifacts/api-server/downloads/` — temporary per-job download directories (auto-cleaned)

## Architecture decisions

- **In-memory job store**: Downloads are tracked in a `Map<string, DownloadJob>` in the API server process. Simple and sufficient for a single-user tool. Jobs are deleted after the file is served.
- **Job-based async flow**: POST to start a job → poll GET for status → browser navigates to file endpoint to trigger download. Avoids streaming timeouts on long downloads.
- **Per-job temp directories**: Each job gets its own directory under `downloads/<jobId>/` to avoid filename collisions. Cleaned up after successful download.
- **Auto source detection**: Frontend infers Spotify vs YouTube from the URL on the client side; still falls back to YouTube for unknown URLs.

## Product

Users paste a Spotify or YouTube URL. The app auto-detects the source, starts an async download job, polls until done, and delivers the MP3 file directly to the browser.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `spotdl` and `yt-dlp` are installed as Python packages via uv in `.pythonlibs/`
- `ffmpeg` is a system dependency required by `yt-dlp` for audio conversion
- The in-memory job store resets on server restart — in-flight downloads are lost if the server crashes

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

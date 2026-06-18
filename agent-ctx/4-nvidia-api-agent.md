# Task 4: NVIDIA NIM API Integration

## Agent: nvidia-api-agent

## Work Log:

### 1. Updated `.env`
- Added `NVIDIA_API_KEY=nvapi-PLACEHOLDER_USER_MUST_REPLACE` to `/home/z/my-project/.env`

### 2. Completely rewrote `src/app/api/chat/route.ts`
- Replaced the mock-only chat endpoint with a full NVIDIA NIM integration
- **New architecture:**
  - `streamNvidiaResponse()` — Streams tokens from NVIDIA NIM via SSE, using a `TransformStream` to extract `delta.content` from SSE `data:` lines
  - `fetchNvidiaResponse()` — Non-streaming fallback that calls NVIDIA NIM and returns the full response
  - `generateFootballAnalysis()` — Preserved the entire existing mock engine as an offline fallback
  - `gatherMatchContext()` — Extracted into a reusable async function (same DB query as before)
  - `formatMatchContextForLLM()` — New function that serializes match data (teams, ELO, xG, possession, press intensity, players, community predictions, match goals) into a structured text block appended to the user message
  - `isNvidiaApiKeyConfigured()` — Checks that the env var exists and is not the placeholder
- **Model mapping:**
  - `pro` → `meta/llama-3.1-405b-instruct` (default)
  - `fast` → `meta/llama-3.1-70b-instruct`
  - `local` → `__mock__` (offline mode, uses built-in mock)
- **System prompt:** Professional ELASTICO AI assistant with football analytics expertise, referencing ELO, Poisson, Dixon-Coles, Monte Carlo, xG
- **Fallback chain:** If NVIDIA_API_KEY is not configured or is the placeholder → mock. If NVIDIA API fails → mock with `model: 'mock-fallback'`.
- **Streaming protocol:** First line is a JSON header with `{ type: 'header', model, context }`. Subsequent lines are raw tokens. Empty line signals end of stream. Content-Type: `text/plain`.

### 3. Updated `src/components/elastico/chat-view.tsx`
- **"Powered by NVIDIA AI" badge** in the chat header, using a `Cpu` icon in a primary-colored outline badge
- **Model selector dropdown** (`<Select>`) in the header bar with three options:
  - "ELASTICO Pro (NVIDIA Llama 3.1 405B)" with `Wifi` icon
  - "ELASTICO Fast (NVIDIA Llama 3.1 70B)" with `Wifi` icon
  - "ELASTICO Local (Offline Mode)" with `WifiOff` icon
- **Streaming support:**
  - Creates a placeholder AI message immediately (empty content)
  - For NVIDIA models (`!isLocal`), sends `stream: true` in the request body
  - Reads the response as a `ReadableStream` using a `ReadableStreamDefaultReader`
  - Parses the JSON header line (skips it), then accumulates raw token lines
  - Calls `updateChatMessage(id, { content: accumulated })` on each chunk for real-time rendering
  - The streaming message shows bouncing dots animation while content is empty
  - For local/offline mode, uses the existing JSON response path
- **Model info displayed** in the empty state and subtitle

### 4. Added `updateChatMessage` to Zustand store (`src/store/use-elastico-store.ts`)
- Added to the `ElasticoStore` interface: `updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void`
- Implementation: maps over `chatMessages` and merges updates for the matching ID

### 5. Updated `src/components/elastico/settings-view.tsx`
- Added new imports: `Cpu`, `Wifi`, `WifiOff`, `CheckCircle2`, `XCircle`, `Info`, `Loader2`
- Added `NvidiaApiStatusBadge` component:
  - Sends a status check request to `/api/chat` on mount
  - Shows "Connected" (green badge with CheckCircle2) if `data.model === 'pro'`
  - Shows "Not Configured" (amber badge with XCircle) if `data.model === 'mock-fallback'`
  - Shows "Checking..." (spinner) while loading
  - Accepts `token` prop for auth
- Added `ModelRow` component: displays model name, description, model ID, with "Recommended" and "Offline" badges
- Added Section 7 "AI & NVIDIA Integration" card to settings page:
  - NVIDIA API status with live badge
  - List of 3 available models (Pro, Fast, Local)
  - Info box explaining how to configure `NVIDIA_API_KEY` with link to build.nvidia.com

## Files Modified:
1. `/home/z/my-project/.env` — Added NVIDIA_API_KEY placeholder
2. `/home/z/my-project/src/app/api/chat/route.ts` — Complete rewrite (503 lines)
3. `/home/z/my-project/src/components/elastico/chat-view.tsx` — Complete rewrite (361 lines)
4. `/home/z/my-project/src/store/use-elastico-store.ts` — Added updateChatMessage
5. `/home/z/my-project/src/components/elastico/settings-view.tsx` — Added NVIDIA section + helpers

## Quality:
- No new lint errors in modified files (only pre-existing errors in upload/ and command-palette.tsx)
- No new TypeScript errors in modified files
- All pre-existing TS/lint errors remain unchanged
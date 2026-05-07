# Nexus Aura — Chat Mobile App

A WhatsApp-style real-time group chat mobile app built with Expo (React Native + web), backed by an Express + Socket.io API server and PostgreSQL via Drizzle ORM.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — Expo dev server (port 18115)
- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, React Native, expo-router, Socket.io client
- API: Express 5, Socket.io server, Expo Server SDK (push notifications)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle), esbuild-plugin-pino

## Where things live

- `artifacts/mobile/` — Expo app (`@workspace/mobile`)
  - `app/` — Expo Router screens
  - `components/` — ChatBubble, ChatInput, TypingIndicator, ProfileModal, etc.
  - `contexts/` — AuthContext (user + OTP), SocketContext (real-time state)
  - `constants/colors.ts` — Dark + light palettes
  - `hooks/useColors.ts` — Color scheme hook
- `artifacts/api-server/src/` — Express server (`@workspace/api-server`)
  - `routes/` — auth, chat, users, health
  - `lib/socketManager.ts` — all Socket.io event handling + in-memory state
  - `lib/pushNotifications.ts` — Expo push SDK
- `lib/db/src/schema/` — DB schema (users, rooms, messages, push_tokens, otp_codes, read_receipts)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)

## Architecture decisions

- Socket.io path is `/api/socket.io` so it routes through the shared reverse proxy alongside REST routes
- Auth is username + email → OTP (OTP returned in API response for dev; would be emailed in production)
- In-memory maps for room members, typing users, and read receipts — refreshed from DB on room join
- `socket.io` and `expo-server-sdk` are marked external in esbuild to avoid bundling issues
- Mobile connects to `https://${EXPO_PUBLIC_DOMAIN}` for both REST and Socket.io

## Product

- **Auth**: Register with username + email → OTP verification
- **Chats tab**: Room list with real-time unread badges, last message preview, 3-dot menu
- **Room screen**: Full real-time chat — swipe-to-reply, long-press action sheet, emoji reactions, delete for everyone/me, typing indicators, read receipts, profile modal on avatar tap
- **Updates / Communities / Calls tabs**: Coming-soon placeholder UIs
- **Settings tab**: Profile editing, account rows, logout
- **Push Notifications**: Expo push tokens, tap-to-navigate deep-links, Android notification channel

## Gotchas

- Always mark `socket.io` and `expo-server-sdk` as external in `build.mjs` — they can't be bundled by esbuild
- DB schema must be pushed (`pnpm --filter @workspace/db run push`) before starting the API server on a fresh environment
- The mobile web preview shows a white screen (login gate) — this is expected; test on device via Expo Go QR scan

## Dark Theme Palette

| Token | Value |
|---|---|
| Background | `#0b141a` |
| Card | `#1f2c34` |
| Primary / Accent | `#00a884` |
| Text | `#e9edef` |
| Muted | `#8696a0` |
| Border | `#2a3942` |
| Own bubble | `#005c4b` |
| Danger | `#ef4444` |

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- See the `expo` skill for Expo patterns and pitfalls

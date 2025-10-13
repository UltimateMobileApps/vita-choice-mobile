# Vita Choice — Mobile (Expo)

A compact developer README for the Vita Choice mobile app (Expo).

## Purpose

This README is focused on getting the project running and testing against a local backend. It intentionally keeps feature descriptions brief — use the code and inline docs for implementation details.

## Quick start

Prerequisites:
- Node.js (14+ recommended)
- npm
- Expo CLI (optional; `npx expo` works)

Install and run:

```bash
npm install
npx expo start
```

Open on a simulator, emulator, or device via the QR / Expo Dev Tools.

## Local backend & networking notes

When testing against a backend running on your machine, remember:

- `localhost` in the app refers to the device/emulator, not your computer.
- Edit `services/api.ts` and set `API_BASE_URL` to one of:
  - Your machine IP: `http://192.168.x.y:8000/api`
  - Android emulator (AVD): `http://10.0.2.2:8000/api`
  - iOS simulator: `http://localhost:8000/api`
  - Expose with ngrok: `ngrok http 8000` and use the provided HTTPS URL.

After changing `API_BASE_URL`, restart the Expo server and reload the app.

## Authentication behavior (short)

- Registration and login immediately persist tokens and user profile when "Remember me" is enabled.
- The app proactively refreshes access tokens before they expire. For dev/testing we added a small adaptive safety window to avoid repeated refresh calls for very short TTLs.
- If the refresh token expires, the app clears auth state and shows a toast to the user.

If you need to tune refresh timing for tests, edit the timing constants in `services/api.ts`.

## Short feature list

- Register / Login / Logout / Guest mode
- Token lifecycle management (access + refresh) with proactive refresh
- Browse ingredients, view details, cached categories/sources
- Create/update/delete/duplicate formulas, add/remove ingredients
- Compliance check endpoint integration
- Export label/summary/CSV for formulas
- Basic toast notifications and reusable UI components

## Developing

- Code lives under `app/` (screens, navigation) and `components/` (UI primitives).
- API client and token logic are in `services/api.ts`.
- Context providers are in `app/contexts/` (Auth + Toast).

## Troubleshooting

- No requests reaching backend: confirm backend listening on the chosen IP/port and firewall allows connections.
- Many immediate `/auth/refresh/` requests: this happens with very short access-token TTLs. Increase TTL for normal testing or tune constants in `services/api.ts`.
- CORS issues (web): enable the app origin on your backend.

## Contributing


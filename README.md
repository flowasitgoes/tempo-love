# Tempo Love

A lightweight real-time rhythm room for two people.

## Run locally

```bash
npm install
npm run dev:server
```

In another terminal:

```bash
npm run dev:client
```

Open the client URL from Vite (usually `http://localhost:5173`).

## Two-user test

1. Open the app in two browsers/devices on the same network.
2. Enter the same room name and join.
3. Click `Pulse`, `Glow`, or `Rain`.
4. Both clients should hear synchronized sounds on shared beats.

## Notes

- Web Audio starts after a user gesture (click/join).
- Room size is limited to 2 users.
- Server default port: `3001`.
# tempo-love

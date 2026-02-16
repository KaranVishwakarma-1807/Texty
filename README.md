# Texty

Texty is a realtime messaging app with chat, voice call, and video call support.
It now includes JWT authentication and persistent PostgreSQL storage for users, rooms, memberships, and messages.

## Tech stack

- Node.js + Express
- Socket.IO for realtime communication
- WebRTC for peer-to-peer voice/video media
- JWT + bcrypt authentication
- PostgreSQL (`pg`) for persistent DB
- Modular vanilla JavaScript frontend (no framework lock-in)

## Project structure

```text
Texty/
  client/public/
    index.html
    styles.css
    js/
      app.js
      chat.js
      voiceCall.js
      videoCall.js
  server/src/
    server.js
    routes/
      authRoutes.js
    modules/
      authService.js
      db.js
      roomStore.js
      chatHandler.js
      voiceCallHandler.js
      videoCallHandler.js
    db/
      migrate.js
      migrations/
        001_init.sql
```

## Run locally

1. Install dependencies:
   - `npm install`
   - `npm --prefix server install`
2. Configure environment:
   - Copy `server/.env.example` to `server/.env`
   - Set `JWT_SECRET`
   - Set `DATABASE_URL`
   - Keep `PG_SSL=true` for Azure PostgreSQL
3. Run database migrations:
   - `npm --prefix server run migrate`
4. Start app:
   - `npm run dev`
5. Open:
   - `http://localhost:3000`

## Notes

- Open the app in two tabs or browsers to test chat and calls.
- Voice/video calling requires camera/microphone permissions.
- Signaling is room-scoped and supports direct calls between selected participants.
- Message history is persisted in PostgreSQL and loaded per room.

# 3M Kids Zone — Telegram Bot

Telegram bot for managing customers who purchase educational video content from **3M Kids Zone**.

Built with Node.js, TypeScript, and [grammY](https://grammy.dev/).

## Requirements

- Node.js 18 or later (Node.js 22+ recommended for built-in SQLite support)
- npm

## Installation

```bash
npm install
```

## Environment Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows (PowerShell):

   ```powershell
   Copy-Item .env.example .env
   ```

2. Open `.env` and fill in the values (see below).

> **Security:** Never commit `.env` to Git. The bot token and other secrets must stay local only.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Telegram bot token from [@BotFather](https://t.me/BotFather) |
| `ADMIN_TELEGRAM_ID` | Yes | Your Telegram numeric user ID (admin access) |
| `CHANNEL_ID` | No | Private channel ID for invite links (see below) |
| `CONTACT_USERNAME` | No | Telegram username for the contact button (e.g. `support_account` or `@support_account`) |

### How to get `BOT_TOKEN`

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the prompts.
3. Copy the token BotFather gives you into `BOT_TOKEN` in your `.env` file.

### How to get `ADMIN_TELEGRAM_ID`

1. Open [@userinfobot](https://t.me/userinfobot) or [@getidsbot](https://t.me/getidsbot) in Telegram.
2. Send any message — the bot will reply with your numeric user ID.
3. Put that number in `ADMIN_TELEGRAM_ID` in your `.env` file.

### How to get `CHANNEL_ID`

The private channel is **3M Kids Zone**. To connect the bot later:

1. Create or open the private Telegram channel.
2. Add your bot as an **administrator** with permission to **invite users via link**.
3. Forward a message from the channel to [@userinfobot](https://t.me/userinfobot) or use the Telegram API to obtain the channel ID (usually starts with `-100`).
4. Set `CHANNEL_ID` in `.env`.

Until `CHANNEL_ID` is configured and the bot has channel admin rights, invite-link generation will remain disabled (the bot will not attempt channel API calls).

## Running Locally (Development)

```bash
npm run dev
```

This starts the bot with hot reload via `tsx`.

## Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

Type-check without emitting files:

```bash
npm run typecheck
```

## Production

```bash
npm run build
npm start
```

## Bot Features

### User menu (`/start`)

- 🎓 **التعرف على المحتوى** — About 3M Kids Zone educational content
- 🛒 **طلب المحتوى** — Placeholder product/order flow
- 📞 **التواصل معنا** — Contact link from `CONTACT_USERNAME`

### Admin panel (`/admin`)

Available only to the user whose ID matches `ADMIN_TELEGRAM_ID`:

- 📦 **الطلبات** — View orders
- 👥 **العملاء** — View customers
- 🔗 **روابط الدعوة** — Invite link status (generation coming soon)
- ⚙️ **الإعدادات** — Configuration overview

## Project Structure

```
src/
├── index.ts              Entry point
├── bot.ts                Bot setup and routing
├── config/env.ts         Environment configuration
├── data/products.ts      Product catalog (editable)
├── database/             SQLite orders storage
├── handlers/             Command and callback handlers
├── keyboards/            Inline keyboard definitions
├── middleware/           Admin authentication
├── services/             Invite link service (channel integration)
└── utils/logger.ts       Logging (secrets redacted)
```

## Connecting to the Private Channel (Later)

When you are ready to enable unique invitation links:

1. Set `CHANNEL_ID` in `.env`.
2. Add the bot as admin on the **3M Kids Zone** private channel.
3. Grant **Invite users via link** permission.
4. The invite link service (`src/services/inviteLink.ts`) is prepared to create links with:
   - One customer per link (`member_limit: 1`)
   - No expiration by default
   - Join request support when the channel requires approval
   - Unique internal names (`order-001`, `order-002`, …)

Automatic link generation on order confirmation will be wired up in a future update.

## Data Storage

Orders are stored in a local SQLite database at `data/orders.db`. This file is gitignored.

## License

Private — 3M Kids Zone

# Clotic

## Introduction

Clotic was born from the need to run Telegram bots in a serverless environment without worrying about traditional hosting, scaling, or managing infrastructure. The idea is simple yet ambitious: create a system that receives Telegram updates via a webhook, saves these messages to a Cloudflare D1 database, processes media files through Cloudflare R2, and then uses a series of workflow steps to update and send the messages—all while respecting Telegram's strict rate limits. 

In the demo project, every incoming message is immediately acknowledged and stored in the database with an initial flag (`prepared = false`). A background workflow then waits for a predetermined period (15 seconds) before updating the message text to include a friendly prefix ("I have got your message: ") and marks the message as prepared. Only messages that have been marked as prepared are processed by the scheduled (cron) handler, ensuring that no unprocessed or incomplete messages are sent to Telegram. Here is the point where you can add any heavy processing of the messages.

## What's New in Version 1.2.0

### 🔧 Development Mode with Long Polling

Added comprehensive development support with automatic mode switching:

- **Development Mode**: Set `DEV=true` to enable long polling mode
  - Automatically deletes existing webhooks
  - Uses `getUpdates` API for continuous polling
  - Perfect for local development and testing
  - No need to expose local server to the internet

- **Production Mode**: Set `DEV=false` for webhook mode (default)
  - Automatically sets up webhooks using `DOMAIN` environment variable
  - Optimized for serverless deployment
  - Better performance and resource usage

### 🚀 Environment Variables

New configuration options:
- `DEV`: Controls development/production mode (`"true"` or `"false"`)
- `DOMAIN`: Your worker's domain for webhook setup (e.g., `"https://your-worker.workers.dev"`)

### 📁 New Files

- `src/polling.ts`: Complete long polling implementation with webhook management

This update makes development much easier while maintaining production efficiency!

## Features

- **Serverless Architecture:**  
  Clotic is built entirely on Cloudflare Workers, eliminating the need for traditional hosting and enabling automatic scaling and high availability.

- **Real-Time Telegram Integration:**  
  The worker receives Telegram updates via a webhook, ensuring real-time interaction with your Telegram bot.

- **Development & Production Modes:**  
  Seamlessly switch between long polling for development and webhooks for production using environment variables.

- **Database Management with Cloudflare D1:**  
  All incoming messages are stored in a SQLite‑compatible Cloudflare D1 database, making data management simple and efficient.

- **Media Handling via Cloudflare R2:**  
  For messages that include photos or documents, Clotic checks for duplicate media, stores new files in Cloudflare R2 (via R2Bucket), and tracks them to avoid redundant uploads.

- **Workflow-Oriented Processing:**  
  Clotic utilizes a simple yet powerful workflow mechanism with explicit steps. The workflow:
  - Saves the message and immediately acknowledges receipt.
  - Long-time processing (now wait for 15 seconds only).
  - Updates the message by prepending a friendly confirmation text and marks it as prepared.
  
  This ensures that only fully processed messages are later picked up by the scheduled sender.

- **Scheduled Processing:**  
  A cron‑triggered handler processes only those messages that have been marked as prepared, applying rate limits and ensuring smooth delivery to Telegram.

- **Robust Retry Mechanism:**  
  If message sending fails, the system uses exponential backoff to reschedule processing without overwhelming the Telegram API.

## Architecture

Clotic is designed with modularity and resilience in mind. It consists of two primary flows:

1. **Webhook Flow (Real-Time Processing):**  
   When Telegram sends an update to the bot's webhook URL, the worker:
   - Parses the incoming JSON.
   - Saves the message into the Cloudflare D1 database with `prepared = false`.
   - Immediately responds to Telegram with an acknowledgment.
   - Initiates a background workflow using Cloudflare Workflows (steps)
   - Marking the message as prepared.

2. **Scheduled (Cron) Flow (Batch Processing):**  
   A scheduled event (cron) is used to pick up messages that are ready (i.e., `prepared = true`) and unprocessed. This handler applies any necessary rate-limiting rules and processes message batches asynchronously using `ctx.waitUntil` to ensure that the worker remains responsive.

This design ensures that the system is both reactive (handling updates immediately) and proactive (processing messages in controlled batches), striking a balance between responsiveness and reliability.

## Project Structure

The project is organized into several files to maintain clarity and modularity:

```
clotic/
├── package.json               // Node.js package configuration.
├── tsconfig.json              // TypeScript compiler configuration.
├── wrangler.json              // Cloudflare Wrangler configuration.
├── README.md                  // This project description.
├── migrations/                // Database migration files and utilities.
│   ├── 000_initial.sql        // Initial database schema.
│   ├── create_migration.ts    // Utility to create new migrations.
│   └── migration_runner.ts    // Migration execution utility.
└── src/
    ├── config.ts              // Extracts configuration settings from environment variables.
    ├── db/
    │   └── migrations.ts      // Database migration management.
    ├── types/
    │   └── default.ts         // TypeScript types and interfaces.
    ├── db.ts                  // Database access layer for D1 operations.
    ├── storage.ts             // Helper for interacting with R2 (R2Bucket) storage.
    ├── telegram.ts            // Telegram API client for sending messages.
    ├── rateLimiter.ts         // Implements rate limiting logic.
    ├── processor.ts           // Processes prepared messages (e.g., sending them via the Telegram API).
    ├── messageHandler.ts      // HTTP handler for processing incoming Telegram updates. 
    ├── workflow.ts            // Defines workflow steps (save, delay, update) using Cloudflare Workflows.
    ├── polling.ts             // Long polling implementation for development mode.
    └── index.ts               // Entry point for the Worker: fetch and scheduled handlers.
```

## Setup and Installation

1. **Clone the Repository**
  ```bash
  git clone https://github.com/bgrusnak/clotic.git
  cd clotic
  ```

2. **Install Dependencies**
  ```bash
  npm install
  ```

3. **Build the Project**
  ```bash
  npm run build
  ```

4. **log in to Cloudflare**:
  ```sh
  wrangler login
  ```

5. **create the DB**:
You need to get the DB id after this step
  ```sh
  wrangler d1 create clotic
  ``` 

6. **Configure Environment Variables**:
Update `wrangler.json`

  > ⚠ **Replace `<YOUR_CLOUDFLARE_ACCOUNT_ID>`  with actual value!**  
  > ⚠ **Replace `<YOUR_TELEGRAM_BOT_TOKEN>` with actual value!**  
  > ⚠ **Replace `<YOUR_D1_DATABASE_ID>` with actual value!**   
  > ⚠ **Replace `<YOUR_WORKER_SUBDOMAIN>` with actual value!**   

### Environment Configuration

Configure the following variables in `wrangler.json`:

```json
{
  "vars": {
    "TELEGRAM_API_TOKEN": "<YOUR_TELEGRAM_BOT_TOKEN>",
    "TELEGRAM_API_URL": "https://api.telegram.org",
    "RATE_LIMIT_PRIVATE": "1",
    "RATE_LIMIT_CHANNEL": "20",
    "RATE_LIMIT_GLOBAL": "30",
    "DEV": "false",
    "DOMAIN": "https://<YOUR_WORKER_SUBDOMAIN>.workers.dev"
  }
}
```

**Development Mode Settings:**
- Set `"DEV": "true"` for local development with long polling
- Set `"DEV": "false"` for production with webhooks (default)

**Production Mode Settings:**
- Ensure `"DOMAIN"` points to your actual worker domain
- Use `"DEV": "false"` for webhook-based operation

4. **Initialize the Storages**
  ```sh
  npm run setup
  ```

## Wrangler Configuration

The `wrangler.json` file includes settings and bindings necessary to deploy Clotic on Cloudflare Workers:

- **D1 Database Binding**:  
  Binds the D1 database to the variable `D1_DB`.
- **R2 (R2Bucket) Binding**:  
  Binds the R2 storage to the variable `R2_BUCKET`.
- **Environment Variables**:  
  Configures Telegram API credentials, rate limiting parameters, and mode settings for different deployment environments.

## Development vs Production

### Development Mode (`DEV=true`)

Perfect for local development and testing:

```json
"DEV": "true"
```

**Features:**
- Uses long polling (`getUpdates`) instead of webhooks
- Automatically deletes existing webhooks on startup
- No need to expose local server to internet
- Continuous polling for immediate development feedback
- All workflow processing works the same way

**Usage:**
```bash
npm run dev
```

The worker will automatically start in development mode and begin polling for updates.

### Production Mode (`DEV=false`)

Optimized for serverless deployment:

```json
"DEV": "false",
"DOMAIN": "https://your-worker.workers.dev"
```

**Features:**
- Uses webhooks for efficient real-time processing
- Automatically sets up webhooks using the provided domain
- Better performance and resource usage
- Cloudflare's edge network optimization

## Deployment

Deploy Clotic using Cloudflare Wrangler:

  ```bash
  npm run deploy
  npm run migrate-remote
  ```

Ensure that you have set up the required environment variables (e.g., `TELEGRAM_API_TOKEN`, `TELEGRAM_API_URL`, `RATE_LIMIT_PRIVATE`, `RATE_LIMIT_CHANNEL`, `DEV`, `DOMAIN`), and that your D1 database and R2 bucket bindings are correctly configured in your Cloudflare dashboard.

## Post-deployment

### Automatic Webhook Setup (v1.2.0+)

Starting from version 1.2.0, webhooks are automatically managed:

- **Production Mode**: Webhooks are automatically set using the `DOMAIN` environment variable
- **Development Mode**: Webhooks are automatically deleted and long polling is used

### Manual Webhook Setup (if needed)

If you need to manually set up the webhook, use:

```sh
curl -X POST "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/webhook"
```

## Usage

- **Message Processing**:  
  Incoming Telegram updates are stored in the D1 database, and media files are saved in R2 if necessary.
- **Scheduled Processing**:  
  Clotic's scheduled handler processes only those messages that are marked as prepared. This handler can be triggered via a cron schedule in Cloudflare, ensuring that prepared messages are sent out while respecting Telegram's rate limits.
- **Development Testing**:  
  Set `DEV=true` in your environment variables to test locally without webhook setup.
- **Monitoring**:  
  Use Cloudflare's built-in logging and monitoring tools to track the performance and any issues in your worker.

## Contributing

Contributions are welcome! If you have suggestions or improvements, please open an issue or submit a pull request on the [GitHub repository](https://github.com/bgrusnak/clotic).

## License

This project is licensed under the [MIT License](LICENSE).

---

*Happy coding!
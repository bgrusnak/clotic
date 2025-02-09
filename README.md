# Clotic

## Introduction

Clotic was born from the need to run Telegram bots in a serverless environment without worrying about traditional hosting, scaling, or managing infrastructure. The idea is simple yet ambitious: create a system that receives Telegram updates via a webhook, saves these messages to a Cloudflare D1 database, processes media files through Cloudflare R2, and then uses a series of workflow steps to update and send the messages—all while respecting Telegram’s strict rate limits. 

In the demo project, every incoming message is immediately acknowledged and stored in the database with an initial flag (`prepared = false`). A background workflow then waits for a predetermined period (15 seconds) before updating the message text to include a friendly prefix ("I have got your message: ") and marks the message as prepared. Only messages that have been marked as prepared are processed by the scheduled (cron) handler, ensuring that no unprocessed or incomplete messages are sent to Telegram. Here is the point where you can add any heavy processing of the messages.

## Features

- **Serverless Architecture:**  
  Clotic is built entirely on Cloudflare Workers, eliminating the need for traditional hosting and enabling automatic scaling and high availability.

- **Real-Time Telegram Integration:**  
  The worker receives Telegram updates via a webhook, ensuring real-time interaction with your Telegram bot.

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
   When Telegram sends an update to the bot’s webhook URL, the worker:
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
├── init.sql                   // SQL script for initializing the D1 database.
└── src/
    ├── config.ts              // Extracts configuration settings from environment variables.
    ├── types.ts               // TypeScript types and interfaces.
    ├── db.ts                  // Database access layer for D1 operations.
    ├── storage.ts             // Helper for interacting with R2 (R2Bucket) storage.
    ├── telegram.ts            // Telegram API client for sending messages.
    ├── rateLimiter.ts         // Implements rate limiting logic.
    ├── processor.ts           // Processes prepared messages (e.g., sending them via the Telegram API).
    ├── messageHandler.ts      // HTTP handler for processing incoming Telegram updates.
    ├── followUp.ts            // Implements the follow-up step to update messages.
    ├── workflow.ts            // Defines workflow steps (save, delay, update) using Cloudflare Workflows. 
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
  Configures Telegram API credentials and rate limiting parameters for different deployment environments (production and development).

## Deployment

Deploy Clotic using Cloudflare Wrangler:

```bash
npm run deploy
npm run init-remote
```

Ensure that you have set up the required environment variables (e.g., `TELEGRAM_API_TOKEN`, `TELEGRAM_API_URL`, `RATE_LIMIT_PRIVATE`, `RATE_LIMIT_CHANNEL`), and that your D1 database and R2 bucket bindings are correctly configured in your Cloudflare dashboard.

## Post-deployment

Set Up the Telegram Webhook

After deployment, **register the Telegram Webhook**, replacing `<YOUR_WORKER_SUBDOMAIN>` with your Cloudflare domain:
```sh
curl -X POST "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/webhook"
```

## Usage

- **Message Processing**:  
  Incoming Telegram updates are stored in the D1 database, and media files are saved in R2 if necessary.
- **Scheduled Processing**:  
  Clotic’s scheduled handler processes only those messages that are marked as prepared. This handler can be triggered via a cron schedule in Cloudflare, ensuring that prepared messages are sent out while respecting Telegram’s rate limits.
- **Monitoring**:  
  Use Cloudflare's built-in logging and monitoring tools to track the performance and any issues in your worker.

## Contributing

Contributions are welcome! If you have suggestions or improvements, please open an issue or submit a pull request on the [GitHub repository](https://github.com/bgrusnak/clotic).

## License

This project is licensed under the [MIT License](LICENSE).

---

*Happy coding!
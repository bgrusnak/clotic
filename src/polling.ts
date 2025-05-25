// src/polling.ts
import { Env } from "./types/default";
import { runWorkflow } from "./workflow";

/**
 * Deletes the webhook for the Telegram bot
 */
async function deleteWebhook(env: Env): Promise<void> {
  const url = `${env.TELEGRAM_API_URL}/bot${env.TELEGRAM_API_TOKEN}/deleteWebhook`;
  try {
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();
    console.log('Webhook deleted:', data);
  } catch (error) {
    console.error('Failed to delete webhook:', error);
  }
}

/**
 * Sets the webhook for the Telegram bot
 */
async function setWebhook(env: Env): Promise<void> {
  const webhookUrl = `${env.DOMAIN}/webhook`;
  const url = `${env.TELEGRAM_API_URL}/bot${env.TELEGRAM_API_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  try {
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();
    console.log('Webhook set:', data);
  } catch (error) {
    console.error('Failed to set webhook:', error);
  }
}

/**
 * Gets updates from Telegram using long polling
 */
async function getUpdates(env: Env, offset: number = 0): Promise<any[]> {
  const url = `${env.TELEGRAM_API_URL}/bot${env.TELEGRAM_API_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
  try {
    const response = await fetch(url);
    const data:any = await response.json();
    if (data.ok && data.result) {
      return data.result;
    }
    return [];
  } catch (error) {
    console.error('Failed to get updates:', error);
    return [];
  }
}

/**
 * Starts long polling for development mode
 */
export async function startPolling(env: Env): Promise<void> {
  console.log('Starting development mode with long polling...');
  
  // Delete webhook first
  await deleteWebhook(env);
  
  let offset = 0;
  
  while (true) {
    try {
      const updates = await getUpdates(env, offset);
      
      for (const update of updates) {
        // Process each update through the workflow
        if (update.message) {
          const mockRequest = new Request('https://dummy.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update)
          });
          
          try {
            await runWorkflow(mockRequest, env);
            console.log(`Processed update ${update.update_id}`);
          } catch (error) {
            console.error(`Failed to process update ${update.update_id}:`, error);
          }
        }
        
        offset = update.update_id + 1;
      }
      
      // Small delay to prevent excessive API calls
      if (updates.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Polling error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Sets up webhook for production mode
 */
export async function setupWebhook(env: Env): Promise<void> {
  console.log('Setting up webhook for production mode...');
  await setWebhook(env);
}
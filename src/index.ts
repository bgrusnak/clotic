// src/index.ts
import { runWorkflow } from "./workflow";
import { processMessages } from "./processor"; 
import { Env } from "./types/default";
import { startPolling, setupWebhook } from "./polling";

/**
 * The fetch handler for processing incoming HTTP requests.
 * It runs the workflow steps and returns the acknowledgment response.
 */
export async function fetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Check if this is a development mode initialization request
  if (env.DEV === "true") {
    // In development mode, start polling instead of handling webhook requests
    ctx.waitUntil(startPolling(env));
    return new Response("Development mode started with long polling", { status: 200 });
  }

  // Production mode: handle webhook requests normally
  const workflowResult = await runWorkflow(request, env);
  return workflowResult.response;
}

/**
 * The scheduled handler for processing scheduled events.
 * It uses Cloudflare workflow mechanics (such as ctx.waitUntil) to process prepared messages asynchronously.
 */
export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> { 
  // Initialize webhook setup in production mode
  if (env.DEV !== "true" && env.DOMAIN) {
    ctx.waitUntil(setupWebhook(env));
  }
  
  ctx.waitUntil(processMessages(env));
}

// Export a default object to mark this module as an ES Module.
export default {
  fetch,
  scheduled,
};
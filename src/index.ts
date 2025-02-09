// src/index.ts
import { runWorkflow } from "./workflow";
import { processMessages } from "./processor"; 
import { Env } from "./types";

/**
 * The fetch handler for processing incoming HTTP requests.
 * It runs the workflow steps and returns the acknowledgment response.
 */
export async function fetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Run the workflow which includes saving the message, waiting 15 seconds, and updating it.
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
  ctx.waitUntil(processMessages(env));
}

// Export a default object to mark this module as an ES Module.
export default {
  fetch,
  scheduled,
};

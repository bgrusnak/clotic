// src/workflow.ts
import { Env } from "./types";
import { Database } from "./db";
import { handleIncomingMessage } from "./messageHandler"; 

/**
 * A type representing a workflow step.
 */
interface WorkflowStep {
  name: string;
  execute: (input: any, env: Env) => Promise<any>;
}

/**
 * Step 1: Save the incoming message.
 * Input: the Request object.
 * Output: an object { response, messageId }.
 */
const saveMessageStep: WorkflowStep = {
  name: "saveMessage",
  execute: async (input: Request, env: Env) => {
    const result = await handleIncomingMessage(input, env);
    return result;
  }
};

/**
 * Step 2: Wait for 15 seconds.
 * Input: the output of the previous step.
 * Output: the same object passed through.
 */
const delayStep: WorkflowStep = {
  name: "delay",
  execute: async (input: any, env: Env) => {
    await new Promise((resolve) => setTimeout(resolve, 15000));
    return input;
  }
};

/**
 * Step 3: Update the message content by prepending text and marking it as prepared.
 * Input: an object containing at least { messageId }.
 */
const updateMessageStep: WorkflowStep = {
  name: "updateMessage",
  execute: async (input: any, env: Env) => {
    const db = new Database(env.D1_DB);
    const prefix = "I have got your message: ";
    await db.prependMessageContentAndMarkPrepared(input.messageId, prefix);
    return input;
  }
};

/**
 * Runs the workflow steps sequentially.
 *
 * @param request - The original HTTP request.
 * @param env - The environment bindings.
 * @returns The final output from the workflow (including the HTTP response).
 */
export async function runWorkflow(request: Request, env: Env): Promise<any> { 
  
  let context: any = request;
  const steps: WorkflowStep[] = [saveMessageStep, delayStep, updateMessageStep];
  
  for (const step of steps) {
    context = await step.execute(context, env);
  }
  return context;
}

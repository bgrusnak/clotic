// src/config.ts
// This file exports the configuration settings by reading environment variables and returning a strongly typed configuration object.

import { Env } from "./types/default";

/**
 * Interface representing the configuration settings required by the application.
 */
export interface Config {
  TELEGRAM_API_TOKEN: string;
  TELEGRAM_API_URL: string;
  RATE_LIMIT_PRIVATE: number;
  RATE_LIMIT_CHANNEL: number;
  RATE_LIMIT_GLOBAL: number;
}

/**
 * Extracts and parses the configuration variables from the provided environment bindings.
 * 
 * @param env - The environment bindings containing necessary variables.
 * @returns A configuration object with typed properties.
 */
export function getConfig(env: Env): Config {
  return {
    TELEGRAM_API_TOKEN: env.TELEGRAM_API_TOKEN,
    TELEGRAM_API_URL: env.TELEGRAM_API_URL,
    RATE_LIMIT_PRIVATE: parseInt(env.RATE_LIMIT_PRIVATE, 10) || 1,
    RATE_LIMIT_CHANNEL: parseInt(env.RATE_LIMIT_CHANNEL, 10) || 20,
    RATE_LIMIT_GLOBAL: parseInt(env.RATE_LIMIT_GLOBAL, 10) || 30,
  };
}

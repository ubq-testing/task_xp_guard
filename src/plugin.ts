import { Octokit } from "@octokit/rest";
import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { isStartCommandEvent } from "./types/typeguards";
import { LogLevel, Logs } from "@ubiquity-dao/ubiquibot-logger";
import { handleExperienceChecks } from "./handlers/handle-xp-check";

/**
 * The main plugin function. Split for easier testing.
 */
export async function runPlugin(context: Context, token: string) {
  const { logger, eventName } = context;

  if (isStartCommandEvent(context)) {
    return await handleExperienceChecks(context, token);
  } else {
    throw logger.error(`Unsupported event: ${eventName}`)?.logMessage.raw;
  }
}

/**
 * How a worker executes the plugin.
 */
export async function plugin(inputs: PluginInputs, env: Env) {
  const octokit = new Octokit({ auth: inputs.authToken });

  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    env,
    logger: new Logs("info" as LogLevel),
  };

  return runPlugin(context, inputs.authToken);
}

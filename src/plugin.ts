import { Octokit } from "@octokit/rest";
import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { isStartCommandEvent } from "./types/typeguards";
import { LogLevel, Logs } from "@ubiquity-dao/ubiquibot-logger";
import { handleExperienceChecks } from "./handlers/handle-xp-check";
import manifest from "../manifest.json";

/**
 * The main plugin function. Split for easier testing.
 */
export async function runPlugin(context: Context, token: string) {
  const { logger, eventName } = context;

  if (await isStartCommandEvent(context)) {
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

  const result = await runPlugin(context, inputs.authToken);

  return returnDataToKernel(context, inputs.stateId, { result });
}

async function returnDataToKernel(context: Context, stateId: string, output: object) {
  const { octokit, payload } = context;
  await octokit.repos.createDispatchEvent({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    event_type: "return_data_to_ubiquibot_kernel",
    client_payload: {
      pluginName: manifest.name,
      state_id: stateId,
      output: JSON.stringify(output),
    },
  });
}

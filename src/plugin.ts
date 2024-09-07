import { Octokit } from "@octokit/rest";
import { PluginInputs } from "./types";
import { Context } from "./types";
import { LogLevel, Logs } from "@ubiquity-dao/ubiquibot-logger";
import { handleExperienceChecks } from "./handlers/handle-xp-check";
import manifest from "../manifest.json";

export async function runPlugin(context: Context, token: string) {
  const { logger, eventName } = context;

  if (eventName === "issues.assigned") {
    const result: Record<string, boolean> = await handleExperienceChecks(context, token);

    for (const [user, isOk] of Object.entries(result)) {
      if (!isOk) {
        logger.info(`${user} failed the experience check, removing...`);
        try {
          await context.octokit.rest.issues.removeAssignees({
            owner: context.payload.repository.owner.login,
            repo: context.payload.repository.name,
            issue_number: context.payload.issue.number,
            assignees: [user],
          });
        } catch (e) {
          logger.error(`Failed to remove ${user} from issue`, { e });
        }
      }
    }
  } else {
    throw logger.error(`Unsupported event: ${eventName}`).logMessage.raw;
  }
}

/**
 * How a worker executes the plugin.
 */
export async function plugin(inputs: PluginInputs) {
  const octokit = new Octokit({ auth: inputs.authToken });

  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    logger: new Logs("info" as LogLevel),
  };

  await runPlugin(context, inputs.authToken);
  await returnDataToKernel(context, inputs.stateId, {});
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

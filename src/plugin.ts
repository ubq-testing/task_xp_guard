import { Octokit } from "@octokit/rest";
import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { LogLevel, Logs } from "@ubiquity-dao/ubiquibot-logger";
import { handleExperienceChecks } from "./handlers/handle-xp-check";
import manifest from "../manifest.json";

/**
 * The main plugin function. Split for easier testing.
 */
export async function runPlugin(context: Context, token: string) {
  const { logger, eventName } = context;

  if (eventName === "issues.assigned") {
    const result: Record<string, boolean> = await handleExperienceChecks(context, token);

    for (const [user, isOk] of Object.entries(result)) {
      if (!isOk) {
        logger.info(`${user} failed the experience check, removing...`);
        try {
          await context.octokit.issues.removeAssignees({
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

  await runPlugin(context, inputs.authToken);
}
import { Context } from "../types";
import { addCommentToIssue } from "../shared/comment";
import { handleLabelChecks } from "./checks/label";
import { handleStatChecks } from "./checks/stats";
import { checkAccountAge } from "./checks/account-age";

export async function handleExperienceChecks(context: Context, token: string) {
  const {
    logger,
    payload: { comment },
  } = context;

  let users: string[] = [];

  if (comment.user) {
    users = [comment.user.login];
  }

  // for team scenarios
  const usernames = comment.body.match(/@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?/g);
  if (usernames) {
    users = [...users, ...usernames.map((username) => username.slice(1))];
  }

  // we'll eject the user if this is false
  const output: Record<string, boolean> = {};

  for (const user of users) {
    logger.info(`Checking ${user}'s experience`);
    try {
      const isOk = await checkUserExperience(context, token, user);
      output[user] = isOk;
      if (isOk) {
        logger.info(`${user} has passed the experience check`);
      }
    } catch (error) {
      logger.error(`Failed to check ${user}'s experience`, { e: error });
      output[user] = false;
    }
  }

  return output;
}

async function checkUserExperience(context: Context, token: string, user: string) {
  const {
    config: {
      labelFilters,
      xpTiers,
      statThresholds: { issues, minCommitsThisYear, prs, stars },
    },
  } = context;

  if (!(await checkAccountAge(context, user))) {
    const log = context.logger.error(`${user} has not met the minimum account age requirement`);
    await addCommentToIssue(context, log?.logMessage.diff as string);
    return false;
  }

  // normalize the tiers
  const tiers = Object.entries(xpTiers).reduce(
    (acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    },
    {} as Record<string, number>
  );

  const hasPassedLabelChecks = await handleLabelChecks(context, token, labelFilters, tiers, user);
  const hasPassedStatChecks = await handleStatChecks(context, token, user, minCommitsThisYear, prs, issues, stars);

  // if either of the checks fail, we'll remove the user
  return hasPassedStatChecks && hasPassedLabelChecks;
}

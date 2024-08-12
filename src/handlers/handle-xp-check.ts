import { Context } from "../types";
import { handleLabelChecks } from "./checks/label";
import { handleStatChecks } from "./checks/stats";
import { checkAccountAge } from "./checks/account-age";
import { isOrgMember } from "./checks/org-membership";

export async function handleExperienceChecks(context: Context, token: string) {
  const {
    logger,
    payload: { issue },
    config: { enableChecksForOrgMembers: shouldEnableChecksForOrgMembers },
  } = context;

  const usernames = issue.assignees.length
    ? issue.assignees.map((assignee) => assignee?.login).filter((a) => a !== undefined)
    : [issue.assignee?.login].filter((a) => a !== undefined);

  if (!usernames.length) {
    const log = logger.error("No assignees found on the issue", { issue: issue.html_url, assignees: issue.assignees });
    throw new Error(log?.logMessage.diff as string);
  }

  // we'll eject the user if this is false
  const output: Record<string, boolean> = {};

  for (const user of usernames) {
    // are we bypassing the checks for org members?
    if (!shouldEnableChecksForOrgMembers) {
      // need to find out their role/permissions in the org
      const isAnOrgMember = await isOrgMember(context, user);

      if (isAnOrgMember) {
        logger.info(`${user} is a member of the organization, skipping experience checks`);
        output[user] = true;
        continue;
      }
    }

    logger.info(`Checking ${user}'s experience`);
    try {
      const isOk = await checkUserExperience(context, token, user);
      output[user] = isOk;
      if (isOk) {
        logger.info(`${user} has passed the experience check`);
      } else {
        logger.info(`${user} has not passed the experience check`);
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
      statThresholds: { issues, minCommits, prs, stars },
    },
  } = context;

  if (!(await checkAccountAge(context, user))) {
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
  const hasPassedStatChecks = await handleStatChecks(context, token, user, minCommits, prs, issues, stars);

  // if either of the checks fail, we'll remove the user
  return hasPassedStatChecks && hasPassedLabelChecks;
}

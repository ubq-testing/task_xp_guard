import { Context } from "../types";
import { addCommentToIssue } from "../shared/comment";
import { handleLabelChecks } from "./checks/label";
import { handleStatChecks } from "./checks/stats";
import { checkAccountAge } from "./checks/account-age";

export async function isOrgMember(context: Context, username?: string): Promise<boolean> {
  if (!username) return false;
  const permissionLevel = await getCollaboratorPermissionLevel(context, username);
  const membership = await getMembershipForUser(context, username);
  const allowedRoles = ["admin", "billing_manager", "owner", "member", "maintainer", "write"];
  return allowedRoles.includes(permissionLevel) || allowedRoles.includes(membership);
}

export async function handleExperienceChecks(context: Context, token: string) {
  const {
    logger,
    payload: { issue },
  } = context;

  const usernames = issue.assignees.length
    ? issue.assignees.map((assignee) => assignee?.login).filter((a) => a !== undefined)
    : [issue.assignee?.login].filter((a) => a !== undefined);

  // we'll eject the user if this is false
  const output: Record<string, boolean> = {};

  for (const user of usernames) {
    // are we bypassing the checks for org members?
    if (!context.config.enableChecksForOrgMembers) {
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
      }
    } catch (error) {
      logger.error(`Failed to check ${user}'s experience`, { e: error });
      output[user] = false;
    }
  }

  return output;
}

async function getCollaboratorPermissionLevel(context: Context, username: string) {
  const owner = context.payload.repository.owner?.login;
  if (!owner) throw context.logger.error("No owner found in the repository!");
  const response = await context.octokit.rest.repos.getCollaboratorPermissionLevel({
    owner,
    repo: context.payload.repository.name,
    username,
  });
  return response.data.permission;
}

async function getMembershipForUser(context: Context, username: string) {
  if (!context.payload.organization) throw context.logger.error(`No organization found in payload!`);

  try {
    await context.octokit.rest.orgs.checkMembershipForUser({
      org: context.payload.organization.login,
      username,
    });
  } catch (e: unknown) {
    return "n/a";
  }

  const { data: membership } = await context.octokit.rest.orgs.getMembershipForUser({
    org: context.payload.organization.login,
    username,
  });
  return membership.role;
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

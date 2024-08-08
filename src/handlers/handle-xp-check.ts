import { Context } from "../types";
import { addCommentToIssue } from "../shared/comment";
import { handleLabelChecks } from "./checks/label";
import { handleStatChecks } from "./checks/stats";
import { accountAgeHandler } from "./checks/account-age";

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
  const usernames = comment.body.match(/@(\w+)/g);
  if (usernames) {
    users = [...users, ...usernames.map((username) => username.slice(1))];
  }

  // we'll eject the user if this is false
  let isOk = true;

  for (const user of users) {
    logger.info(`Checking ${user}'s experience`);
    try {
      isOk = await checkUserExperience(context, token, user);
    } catch (error) {
      logger.error(`Failed to check ${user}'s experience, removing...`, { e: error });
      isOk = false;
    }

    if (!isOk) {
      isOk = await findAndRemoveAssignee(context, user);
      continue;
    }

    logger.info(`${user} meets all requirements`);
  }
}

async function checkUserExperience(context: Context, token: string, user: string) {
  const {
    config: {
      labelFilters,
      xpTiers,
      statThresholds: { issues, minCommitsThisYear, prs, stars },
    },
  } = context;

  if (!(await accountAgeHandler(context, user))) {
    const log = context.logger.error(`@${user} has not met the minimum account age requirement`);
    await addCommentToIssue(context, log?.logMessage.diff as string);
    throw new Error(log?.logMessage.raw as string);
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
  return !!(hasPassedStatChecks && hasPassedLabelChecks);
}

async function findAndRemoveAssignee(context: Context, user: string) {
  const { logger, octokit, payload } = context;

  try {
    const issue = await octokit.issues.get({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
    });

    const assignees = issue.data.assignees?.map((assignee) => assignee.login) || [];

    if (assignees.includes(user)) {
      logger.info(`Removing ${user} from the task`);
      await octokit.rest.issues.removeAssignees({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        assignees: [user],
      });

      const log = logger.info(`@${user} you have been removed from the task due to not meeting the requirements. Please find an alternative task to work on.`);
      await addCommentToIssue(context, log?.logMessage.diff as string);
    }
  } catch (error) {
    const log = logger.error(`Failed to remove ${user} from the task`, { e: error });
    throw new Error(log?.logMessage.raw as string);
  }
  return true;
}

import { Context } from "../../types";
import { addCommentToIssue } from "../../shared/comment";
import { commitsFetcher } from "../fetching/fetch-commits";
import { fetchAccountStats } from "../fetching/fetch-account-stats";

export async function handleStatChecks(context: Context, token: string, user: string, minCommitsThisYear: number, prs: number, issues: number, stars: number) {
  const { logger } = context;
  const stats = await fetchAccountStats(token, user);
  const totalCommits = await commitsFetcher(context, user);

  const hasFailedCommitCheck = totalCommits < minCommitsThisYear;
  const hasFailedPrCheck = stats.totalPRs < prs;
  const hasFailedIssueCheck = stats.totalIssues < issues;
  const hasFailedStarCheck = stats.totalStars < stars;

  function commentMessage(a: number, b: number, type: string) {
    return `${user} does not meet the minimum ${type} requirement. Required: ${b}, Actual: ${a}`;
  }

  if (hasFailedCommitCheck) {
    const log = logger.error(commentMessage(totalCommits, minCommitsThisYear, "commits"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  if (hasFailedPrCheck) {
    const log = logger.error(commentMessage(stats.totalPRs, prs, "PRs"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  if (hasFailedIssueCheck) {
    const log = logger.error(commentMessage(stats.totalIssues, issues, "issues"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  if (hasFailedStarCheck) {
    const log = logger.error(commentMessage(stats.totalStars, stars, "stars"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  logger.info(`${user} stats: `, {
    totalCommits,
    totalPRs: stats.totalPRs,
    totalIssues: stats.totalIssues,
    totalStars: stats.totalStars,
  });

  return !!(hasFailedCommitCheck || hasFailedPrCheck || hasFailedIssueCheck || hasFailedStarCheck);
}

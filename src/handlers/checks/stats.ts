import { Context } from "../../types";
import { addCommentToIssue } from "../../shared/comment";
import { fetchAccountStats } from "../fetching/fetch-account-stats";

export async function handleStatChecks(context: Context, token: string, user: string, minCommitsThisYear: number, prs: number, issues: number, stars: number) {
  const { logger } = context;
  const stats = await fetchAccountStats(token, user);

  const hasPassedCommitCheck = stats.totalCommits > minCommitsThisYear;
  const hasPassedPrCheck = stats.totalPRs > prs;
  const hasPassedIssueCheck = stats.totalIssues > issues;
  const hasPassedStarCheck = stats.totalStars > stars;

  function commentMessage(a: number, b: number, type: string) {
    return `${user} does not meet the minimum ${type} requirement. Required: ${b}, Actual: ${a}`;
  }

  if (!hasPassedCommitCheck) {
    const log = logger.error(commentMessage(stats.totalCommits, minCommitsThisYear, "commit"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  if (!hasPassedPrCheck) {
    const log = logger.error(commentMessage(stats.totalPRs, prs, "PR"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  if (!hasPassedIssueCheck) {
    const log = logger.error(commentMessage(stats.totalIssues, issues, "issue"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  if (!hasPassedStarCheck) {
    const log = logger.error(commentMessage(stats.totalStars, stars, "star"));
    await addCommentToIssue(context, log?.logMessage.diff as string);
  }

  logger.info(`${user} stats: `, {
    totalCommits: stats.totalCommits,
    totalPRs: stats.totalPRs,
    totalIssues: stats.totalIssues,
    totalStars: stats.totalStars,
  });

  return hasPassedCommitCheck && hasPassedPrCheck && hasPassedIssueCheck && hasPassedStarCheck;
}

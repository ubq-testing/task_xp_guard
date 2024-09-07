import { Context } from "../../types";
import { addCommentToIssue } from "../../shared/comment";
import { fetchAccountStats } from "../fetching/fetch-account-stats";

export async function handleStatChecks(context: Context, token: string, user: string, minCommits: number, prs: number, issues: number, stars: number) {
  const { logger } = context;
  const stats = await fetchAccountStats(token, user);

  const hasPassedCommitCheck = stats.totalCommits >= minCommits;
  const hasPassedPrCheck = stats.totalPRs >= prs;
  const hasPassedIssueCheck = stats.totalIssues >= issues;
  const hasPassedStarCheck = stats.totalStars >= stars;

  const msg = [];

  function commentMessage(a: number, b: number, type: string) {
    return `${user} does not meet the minimum ${type} requirement. Required: ${b}, Actual: ${a}`;
  }

  if (!hasPassedCommitCheck) {
    msg.push(logger.error(commentMessage(stats.totalCommits, minCommits, "commit")).logMessage.diff);
  }

  if (!hasPassedPrCheck) {
    msg.push(logger.error(commentMessage(stats.totalPRs, prs, "PR")).logMessage.diff);
  }

  if (!hasPassedIssueCheck) {
    msg.push(logger.error(commentMessage(stats.totalIssues, issues, "issue")).logMessage.diff);
  }

  if (!hasPassedStarCheck) {
    msg.push(logger.error(commentMessage(stats.totalStars, stars, "star")).logMessage.diff);
  }

  logger.info(`${user} stats: `, {
    totalCommits: stats.totalCommits,
    totalPRs: stats.totalPRs,
    totalIssues: stats.totalIssues,
    totalStars: stats.totalStars,
  });

  if (msg.length) {
    await addCommentToIssue(context, msg.join("\n"));
  }

  return hasPassedCommitCheck && hasPassedPrCheck && hasPassedIssueCheck && hasPassedStarCheck;
}

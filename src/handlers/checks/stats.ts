import { Context } from "../../types";
import { addCommentToIssue } from "../../shared/comment";
import { commitsFetcher } from "../fetching/fetch-commits";
import { fetchAccountStats } from "../fetching/fetch-account-stats";

export async function handleStatChecks(
    context: Context,
    token: string,
    user: string,
    minCommitsThisYear: number,
    prs: number,
    issues: number,
    stars: number
) {
    const { logger } = context;
    const stats = await fetchAccountStats(token, user);
    const totalCommits = await commitsFetcher(context, user)

    const commitCheck = totalCommits < minCommitsThisYear;
    const prCheck = stats.totalPRs < prs;
    const issueCheck = stats.totalIssues < issues;
    const starCheck = stats.totalStars < stars;

    function commentMessage(a: number, b: number, type: string) {
        return `${user} does not meet the minimum ${type} requirement. Required: ${b}, Actual: ${a}`;
    }

    if (commitCheck) {
        const log = logger.error(commentMessage(totalCommits, minCommitsThisYear, "commits"))
        await addCommentToIssue(context, log?.logMessage.diff as string);
    }

    if (prCheck) {
        const log = logger.error(commentMessage(stats.totalPRs, prs, "PRs"))
        await addCommentToIssue(context, log?.logMessage.diff as string);
    }

    if (issueCheck) {
        const log = logger.error(commentMessage(stats.totalIssues, issues, "issues"))
        await addCommentToIssue(context, log?.logMessage.diff as string);
    }

    if (starCheck) {
        const log = logger.error(commentMessage(stats.totalStars, stars, "stars"))
        await addCommentToIssue(context, log?.logMessage.diff as string);
    }

    logger.info(`${user} stats: `, {
        totalCommits,
        totalPRs: stats.totalPRs,
        totalIssues: stats.totalIssues,
        totalStars: stats.totalStars
    });

    return !!(commitCheck && prCheck && issueCheck && starCheck)
}
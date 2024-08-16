import { graphqlFetchRetrier } from "../../shared/fetching-utils";
import { VALIDATED_GRAPHQL_QUERIES } from "../../shared/validate-queries";
import { UserStats } from "../../types";

export async function fetchAccountStats(token: string, username: string) {
  const stats = {
    name: username,
    totalPRs: 0,
    totalPRsMerged: 0,
    mergedPRsPercentage: 0,
    totalReviews: 0,
    totalCommits: 0,
    totalIssues: 0,
    totalStars: 0,
    contributedTo: 0,
    rank: 0,
  };

  const user = await fetchGithubUserStats({
    token,
    username,
  });

  if (!user) {
    return stats;
  }

  stats.totalCommits = user.contributionsCollection.totalCommitContributions;
  stats.totalPRs = user.pullRequests.totalCount;
  stats.totalReviews = user.contributionsCollection.totalPullRequestReviewContributions;
  stats.contributedTo = user.repositoriesContributedTo.totalCount;
  stats.totalStars = user.repositories.nodes?.reduce((acc, repo) => acc + (repo?.stargazerCount || 0), 0) || 0;

  stats.totalIssues = user.openIssues.totalCount + user.closedIssues.totalCount;
  stats.totalPRsMerged = user.mergedPullRequests.totalCount;
  stats.mergedPRsPercentage = (user.mergedPullRequests.totalCount / user.pullRequests.totalCount) * 100;

  stats.rank = calculateRank({
    all_commits: true,
    commits: stats.totalCommits,
    prs: stats.totalPRs,
    reviews: stats.totalReviews,
    issues: stats.totalIssues,
    stars: stats.totalStars,
    followers: user.followers.totalCount,
  });

  return stats;
}

async function fetchGithubUserStats({ token, username }: { token: string; username: string }) {
  let stats;
  let hasNextPage = true;
  let endCursor;
  let user = {} as UserStats;

  while (hasNextPage) {
    const vars = {
      login: username,
      first: 100,
      after: endCursor,
      includeMergedPullRequests: true,
    };

    const query = vars.after ? VALIDATED_GRAPHQL_QUERIES.REPOS : VALIDATED_GRAPHQL_QUERIES.STATS;
    const { user: user_ } = await graphqlFetchRetrier(vars, token, query);
    const repoNodes = user_.repositories.nodes || [];

    if (stats) {
      stats.push(...repoNodes);
    } else {
      stats = repoNodes;
    }

    hasNextPage = user_.repositories.pageInfo.hasNextPage;
    endCursor = user_.repositories.pageInfo.endCursor;
    user = user_;
  }

  return { ...user, repositories: { nodes: stats } };
}

/**
 * Scales the user's stats to a percentile rank based
 * on the median of each stat and the weight given to each stat.
 *
 * The rank is calculated as follows:
 * - For each stat, calculate the percentile rank of the user's stat
 *   based on the median of that stat.
 * - Multiply the percentile rank by the weight of that stat.
 * - Sum the weighted percentile ranks and divide by the total weight.
 * - Subtract the sum from 1 to get the final rank.
 * - Multiply by 100 to get the rank as a percentage.
 *
 * Median values and weights are based on the author's opinion and should
 * reflect a reasonable distribution of stats for a typical user.
 *
 * Does not include dollars-earned yet but will be added in the future.
 *
 * Swapping these weights and medians in place of the flat-rate config
 * settings would allow for a more dynamic ranking system but would
 * increase the complexity for partners to setup and use.
 */
export function calculateRank({
  commits,
  prs,
  issues,
  reviews,
  stars,
  followers,
}: {
  all_commits: boolean;
  commits: number;
  prs: number;
  issues: number;
  reviews: number;
  stars: number;
  followers: number;
}) {
  const COMMITS_MEDIAN = 1000,
    COMMITS_WEIGHT = 2;
  const PRS_MEDIAN = 50,
    PRS_WEIGHT = 3;
  const ISSUES_MEDIAN = 25,
    ISSUES_WEIGHT = 1;
  const REVIEWS_MEDIAN = 2,
    REVIEWS_WEIGHT = 1;
  const STARS_MEDIAN = 50,
    STARS_WEIGHT = 4;
  const FOLLOWERS_MEDIAN = 10,
    FOLLOWERS_WEIGHT = 1;

  const TOTAL_WEIGHT = COMMITS_WEIGHT + PRS_WEIGHT + ISSUES_WEIGHT + REVIEWS_WEIGHT + STARS_WEIGHT + FOLLOWERS_WEIGHT;

  const rank =
    1 -
    (COMMITS_WEIGHT * exponentialCdf(commits / COMMITS_MEDIAN) +
      PRS_WEIGHT * exponentialCdf(prs / PRS_MEDIAN) +
      ISSUES_WEIGHT * exponentialCdf(issues / ISSUES_MEDIAN) +
      REVIEWS_WEIGHT * exponentialCdf(reviews / REVIEWS_MEDIAN) +
      STARS_WEIGHT * logNormalCdf(stars / STARS_MEDIAN) +
      FOLLOWERS_WEIGHT * logNormalCdf(followers / FOLLOWERS_MEDIAN)) /
      TOTAL_WEIGHT;

  return Number((rank * 100).toFixed(2));
}

function exponentialCdf(x: number, lambda: number = 1) {
  return 1 - Math.exp(-lambda * x);
}

function logNormalCdf(x: number): number {
  return 0.5 * (1 + (x - 1) / Math.sqrt(1 + x * x));
}

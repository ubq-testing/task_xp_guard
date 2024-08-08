import { calculateRank, graphqlFetchRetrier } from "../../shared/fetching-utils";
import { GRAPHQL_QUERIES } from "../../shared/queries";
import { StatsResponse } from "../../types/shared";
import { isStatsResponse } from "../../types/typeguards";

export async function fetchAccountStats(token: string, username: string) {
  const stats = {
    name: "",
    totalPRs: 0,
    totalPRsMerged: 0,
    mergedPRsPercentage: 0,
    totalReviews: 0,
    totalCommits: 0,
    totalIssues: 0,
    totalStars: 0,
    contributedTo: 0,
    rank: { level: "C", percentile: 100 },
  };

  const user = await statsFetcher({
    token,
    username,
  });

  if (!user) {
    stats.name = username;
    return stats;
  }

  stats.totalCommits = user.contributionsCollection.totalCommitContributions;
  stats.totalPRs = user.pullRequests.totalCount;
  stats.totalPRsMerged = user.mergedPullRequests.totalCount;
  stats.mergedPRsPercentage = (user.mergedPullRequests.totalCount / user.pullRequests.totalCount) * 100;
  stats.totalReviews = user.contributionsCollection.totalPullRequestReviewContributions;
  stats.totalIssues = user.openIssues.totalCount + user.closedIssues.totalCount;
  stats.contributedTo = user.repositoriesContributedTo.totalCount;
  stats.totalStars = user.repositories.nodes?.reduce((prev: number, curr: { stargazers: { totalCount: number } }) => prev + curr.stargazers.totalCount, 0) || 0;

  // could be refactored to be aligned with our actual XP system
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

async function statsQuery(
  variables: {
    login: string;
    first?: number;
    after?: string;
    includeMergedPullRequests?: boolean;
  },
  token: string
) {
  const query = variables.after ? GRAPHQL_QUERIES.REPOS : GRAPHQL_QUERIES.STATS;
  return graphqlFetchRetrier(variables, token, query);
}

async function statsFetcher({ token, username }: { token: string; username: string }) {
  let stats;
  let hasNextPage = true;
  let endCursor;
  let user = {} as StatsResponse["user"];

  while (hasNextPage) {
    const vars = {
      login: username,
      first: 100,
      after: endCursor,
      includeMergedPullRequests: true,
    };
    const data = await statsQuery(vars, token);

    if (!isStatsResponse(data)) {
      return;
    }

    user = data.user;
    const repoNodes = user.repositories.nodes;

    if (stats) {
      stats.push(...repoNodes);
    } else {
      stats = repoNodes;
    }

    hasNextPage = user.repositories.pageInfo.hasNextPage;
    endCursor = user.repositories.pageInfo.endCursor;
  }

  return { ...user, repositories: { nodes: stats } };
}

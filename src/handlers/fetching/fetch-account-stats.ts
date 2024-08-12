import { Maybe } from "@octokit/graphql-schema";
import { graphqlFetchRetrier } from "../../shared/fetching-utils";
import { GRAPHQL_QUERIES } from "../../shared/queries";
import { UserStats } from "../../types";
import { calculateRank } from "../../shared/rank";

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
    rank: 0,
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

async function statsQuery(
  variables: {
    login: string;
    first?: number;
    after?: Maybe<string>;
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
  let user = {} as UserStats;

  while (hasNextPage) {
    const vars = {
      login: username,
      first: 100,
      after: endCursor,
      includeMergedPullRequests: true,
    };

    const { user: user_ } = await statsQuery(vars, token);
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

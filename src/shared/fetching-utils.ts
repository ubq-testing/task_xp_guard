import { graphql } from "@octokit/graphql";
import { RequestParameters } from "@octokit/graphql/dist-types/types";
import { GRAPHQL_QUERIES } from "./queries";
import { StatsResponse, UserResponse } from "../types/shared";

function graphqlFetch(variables: RequestParameters, fn: typeof graphql, query: string): Promise<UserResponse | StatsResponse> {
  return fn(query, variables);
}

export async function graphqlFetchRetrier(
  variables: RequestParameters,
  token: string,
  query = GRAPHQL_QUERIES.LANGS,
  retries = 3
): Promise<UserResponse | StatsResponse> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  try {
    return await graphqlFetch(variables, graphqlWithAuth, query);
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    return graphqlFetchRetrier(variables, token, query, retries - 1);
  }
}

function exponentialCdf(x: number) {
  return 1 - 2 ** -x;
}

function logNormalCdf(x: number) {
  return x / (1 + x);
}

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

  const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  /**
   * A good XP system as-is and we include dollars-earned and weight it considerably more than the other stats
   * We could consider:
   *
   * - Refactor to be dollar/number based i.e Level 1 = $0 - $100, L2 = $101 - $500, L3 = $501 - $2,000, etc
   * - If user level === Level 1, we rely on the metadata markers for guarding
   * - L3 and above, we can use the XP system and disregard the metadata markers
   *   as by that point they'd likely have a good enough track record to be trusted in harder tasks
   *
   * So V1 would be:
   *
   * - task labels: ["Solidity: (Mid)"]
   * - Anyone with the required language percentage can take the task
   *
   * V2 would be:
   *
   * - task labels: ["Solidity: (Mid)", , "Level 3"]
   * - Anyone with the required language can take the task
   *   or anyone with a user dollar-earned XP level of 3 or higher regardless of language
   */
  const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];

  const rank =
    1 -
    (COMMITS_WEIGHT * exponentialCdf(commits / COMMITS_MEDIAN) +
      PRS_WEIGHT * exponentialCdf(prs / PRS_MEDIAN) +
      ISSUES_WEIGHT * exponentialCdf(issues / ISSUES_MEDIAN) +
      REVIEWS_WEIGHT * exponentialCdf(reviews / REVIEWS_MEDIAN) +
      STARS_WEIGHT * logNormalCdf(stars / STARS_MEDIAN) +
      FOLLOWERS_WEIGHT * logNormalCdf(followers / FOLLOWERS_MEDIAN)) /
      TOTAL_WEIGHT;

  const level = LEVELS[THRESHOLDS.findIndex((t) => rank * 100 <= t)];

  return { level, percentile: rank * 100 };
}

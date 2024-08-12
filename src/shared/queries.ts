import { graphql } from "@octokit/graphql";
import { validate } from "@octokit/graphql-schema";

const LANGS_QUERY = `
      query userInfo($login: String!) {
        user(login: $login) {
          repositories(ownerAffiliations: [OWNER, COLLABORATOR], isFork: false, first: 100) {
            nodes {
              name
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    color
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

const GRAPHQL_REPOS_FIELD = `
  repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}, after: $after) {
    totalCount
    nodes {
      name
      stargazers {
        totalCount
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
`;

const GRAPHQL_REPOS_QUERY = `
  query userInfo($login: String!, $after: String) {
    user(login: $login) {
      ${GRAPHQL_REPOS_FIELD}
    }
  }
`;

const GRAPHQL_STATS_QUERY = `
  query userInfo($login: String!, $after: String, $includeMergedPullRequests: Boolean!) {
    user(login: $login) {
      name
      login
      contributionsCollection {
        totalCommitContributions,
        totalPullRequestReviewContributions
      }
      repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
        totalCount
      }
      pullRequests(first: 1) {
        totalCount
      }
      mergedPullRequests: pullRequests(states: MERGED) @include(if: $includeMergedPullRequests) {
        totalCount
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      closedIssues: issues(states: CLOSED) {
        totalCount
      }
      followers {
        totalCount
      }
      ${GRAPHQL_REPOS_FIELD}
    }
  }
`;

function validateQueries() {
  const errors = [
    validate(LANGS_QUERY),
    validate(GRAPHQL_REPOS_QUERY),
    validate(GRAPHQL_STATS_QUERY)
  ].filter(Boolean).flatMap((error) => error);

  if (errors.length) {
    console.log()
    throw new Error(errors.join("\n"));
  }
}

validateQueries();

export const GRAPHQL_QUERIES = {
  LANGS: LANGS_QUERY,
  REPOS: GRAPHQL_REPOS_QUERY,
  STATS: GRAPHQL_STATS_QUERY,
};

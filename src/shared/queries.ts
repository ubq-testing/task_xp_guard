export const LANGS_QUERY = /* GraphQl */ `
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

const GRAPHQL_REPOS_FIELD = /* GraphQl */ `
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

export const GRAPHQL_REPOS_QUERY = /* GraphQl */ `
  query userInfo($login: String!, $after: String) {
    user(login: $login) {
      ${GRAPHQL_REPOS_FIELD}
    }
  }
`;

export const GRAPHQL_STATS_QUERY = /* GraphQl */ `
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
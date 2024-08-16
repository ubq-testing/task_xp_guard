import { validate } from "@octokit/graphql-schema";
import { LANGS_QUERY, GRAPHQL_REPOS_QUERY, GRAPHQL_STATS_QUERY } from "./queries";

function validateQueries() {
  const errors = [validate(LANGS_QUERY), validate(GRAPHQL_REPOS_QUERY), validate(GRAPHQL_STATS_QUERY)].filter(Boolean).flatMap((error) => error);

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

validateQueries();

export const VALIDATED_GRAPHQL_QUERIES = {
  LANGS: LANGS_QUERY,
  REPOS: GRAPHQL_REPOS_QUERY,
  STATS: GRAPHQL_STATS_QUERY,
};

import { validate } from "@octokit/graphql-schema";
import { LANGS_QUERY, GRAPHQL_REPOS_QUERY, GRAPHQL_STATS_QUERY } from "../src/shared/queries";

function validateQueries() {
  const errors = [validate(LANGS_QUERY), validate(GRAPHQL_REPOS_QUERY), validate(GRAPHQL_STATS_QUERY)].filter(Boolean).flatMap((error) => error);

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

validateQueries();
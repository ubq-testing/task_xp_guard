import { graphql } from "@octokit/graphql";
import { RequestParameters } from "@octokit/graphql/dist-types/types";
import { GRAPHQL_QUERIES } from "./queries";
import { UserStats } from "../types";

export async function graphqlFetchRetrier(
  variables: RequestParameters,
  token: string,
  query = GRAPHQL_QUERIES.LANGS,
  retries = 3
): Promise<{ user: UserStats }> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  try {
    return await graphqlWithAuth(query, variables);
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    return graphqlFetchRetrier(variables, token, query, retries - 1);
  }
}
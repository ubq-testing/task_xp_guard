import { graphql } from "@octokit/graphql";
import { UserStats } from "../types";

export async function graphqlFetchRetrier(variables: Record<string, unknown>, token: string, query: string, retries = 3): Promise<{ user: UserStats }> {
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

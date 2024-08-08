import { Context } from "../../types/context.js";
import { CommitsSearch } from "../../types/plugin-inputs.js";

export async function commitsFetcher(context: Context, username: string) {
  const { octokit, logger } = context;

  // We don't want to paginate here because we only need the total count
  // for me this was over 1000 commits
  const {
    data: { total_count: totalCount },
  } = (await octokit.rest.search.commits({
    q: `author:${username}`,
  })) as CommitsSearch;

  logger.info(`Total commits: ${totalCount}`);
  return totalCount;
}

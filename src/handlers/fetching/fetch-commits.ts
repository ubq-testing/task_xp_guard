import { Context } from "../../types/context.js";
import { CommitsSearch } from "../../types/plugin-inputs.js";

export async function commitsFetcher(context: Context, username: string) {
    const { octokit, logger } = context;

    const { data: { total_count: totalCount } } = await octokit.search.commits({
        q: `author:${username}`,
    }) as CommitsSearch;

    logger.info(`Total commits: ${totalCount}`);
    return totalCount
};
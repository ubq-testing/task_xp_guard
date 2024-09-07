import { addCommentToIssue } from "../../shared/comment";
import { Context } from "../../types";

export async function checkAccountAge(context: Context, username: string) {
  const { octokit, payload, logger, config } = context;
  const { sender } = payload;

  const user = await octokit.rest.users.getByUsername({ username });
  const created = new Date(user.data.created_at);
  const ageInDays = Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  const { minAccountAgeInDays } = config;

  if (ageInDays < minAccountAgeInDays || isNaN(ageInDays)) {
    const log = logger.error(`${sender.login} has not met the minimum account age requirement of ${minAccountAgeInDays} days`);
    await addCommentToIssue(context, log.logMessage.diff);
    return false;
  }

  return true;
}

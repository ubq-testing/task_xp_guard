import { Context } from "../../types";

export async function accountAgeHandler(context: Context) {
  const { octokit, payload, logger, config } = context;
  const { sender } = payload;

  const user = await octokit.users.getByUsername({
    username: sender.login,
  });

  const created = new Date(user.data.created_at);
  const age = Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  const {
    minAccountAgeInDays,
  } = config;

  if (age < minAccountAgeInDays || isNaN(age)) {
    logger.error(`${sender.login} has not met the minimum account age requirement of ${minAccountAgeInDays} days`);
    return;
  }

  return true;
}

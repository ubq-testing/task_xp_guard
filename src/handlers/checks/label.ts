import { Context } from "../../types";
import { addCommentToIssue } from "../../shared/comment";
import { fetchTopLanguages } from "../fetching/fetch-language-stats";

export async function handleLabelChecks(context: Context, token: string, labelFilters: string[], xpTiers: Record<string, number>, user: string) {
  const { logger } = context;
  const langs = await fetchTopLanguages(user, token);
  const userLanguages = new Set(
    Object.values(langs).map((lang) => {
      return {
        name: lang.name.toLowerCase(),
        percentage: lang.percentage,
      };
    })
  );
  const issueLabels = context.payload.issue.labels.map((label) => {
    const rankCaptureRegex = /\(([^)]+)\)/;
    return {
      name: label.name.split(":")[0].toLowerCase(),
      tier: rankCaptureRegex.exec(label.name)?.[1]?.toLowerCase() || "n/a",
    };
  });

  // find the label we wish to use as our guard
  const labelFilters_ = issueLabels.filter((label) => labelFilters.some((filter) => filter.toLowerCase() === label.name));

  if (labelFilters_.length === 0) {
    const logMessage = logger.error(`No label guard found for ${user}`);
    await addCommentToIssue(context, logMessage?.logMessage.diff as string);
    throw new Error(logMessage?.logMessage.raw);
  }

  await checkLabelGuards(context, userLanguages, labelFilters_, xpTiers, user);

  return true;
}

async function checkLabelGuards(
  context: Context,
  userLanguages: Set<{ name: string; percentage: number }>,
  labelFilters: { name: string; tier: string }[],
  xpTiers: Record<string, number>,
  user: string
) {
  const { logger } = context;

  const normalizedLabelFilters = labelFilters.map(({ name }) => name.toLowerCase());
  const normalizedUserLanguages = new Set(Array.from(userLanguages).map(({ name }) => name));

  for (const labelFilter of normalizedLabelFilters) {
    if (!normalizedUserLanguages.has(labelFilter)) {
      const logMessage = logger.error(`@${user} does not have the required language for: ${labelFilter}`);
      await addCommentToIssue(context, logMessage?.logMessage.diff as string);
      throw new Error(logMessage?.logMessage.raw);
    }

    const userLang = Array.from(userLanguages).find(({ name }) => name === labelFilter);
    if (!userLang) {
      const logMessage = logger.error(`@${user} failed to pass the required language guard for ${labelFilter}`);
      await addCommentToIssue(context, logMessage?.logMessage.diff as string);
      throw new Error(logMessage?.logMessage.raw);
    }

    const tier = labelFilters.find(({ name }) => name === labelFilter)?.tier || "n/a";

    if (tier === "n/a") {
      logger.info("No label guard found, skipping...");
      return;
    }

    const tierValue = xpTiers[tier];
    if (!tierValue) {
      const logMessage = logger.error(`No tier value found for ${tier}`);
      await addCommentToIssue(context, logMessage?.logMessage.diff as string);
      throw new Error(logMessage?.logMessage.raw);
    }

    if (userLang.percentage < tierValue) {
      const logMessage = logger.error(`@${user} does not meet the required tier for ${labelFilter}`);
      await addCommentToIssue(context, logMessage?.logMessage.diff as string);
      throw new Error(logMessage?.logMessage.raw);
    }
  }
}

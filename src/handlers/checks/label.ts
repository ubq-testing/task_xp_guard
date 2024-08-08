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
    logger.info(`No label guard found for ${user}`);
    return true;
  }

  const msg: string[] = [];

  const highestTieredDuplicates = await findAndRemoveDuplicateFilters(labelFilters_, xpTiers);
  let checked = { hasPassed: true, msg: [""] };
  if (highestTieredDuplicates.length > 0) {
    msg.push(`Duplicate filters found, defaulting to highest tiered filters: ${highestTieredDuplicates.map(({ name }) => name).join(", ")}`)
    checked = await checkLabelGuards(context, userLanguages, highestTieredDuplicates, xpTiers, user);
    msg.push(checked.msg.join(", "));
  } else {
    checked = await checkLabelGuards(context, userLanguages, labelFilters_, xpTiers, user);
    msg.push(checked.msg.join(", "));
  }

  await addCommentToIssue(context, msg.join("\n"));

  return checked.hasPassed;
}

async function findAndRemoveDuplicateFilters(labelFilters: { name: string; tier: string }[], xpTiers: Record<string, number>) {
  const highestTierMap: Record<string, { name: string; tier: string }> = {};

  labelFilters.forEach((label) => {
    const currentTierValue = xpTiers[label.tier];
    const existingEntry = highestTierMap[label.name];

    if (!existingEntry || currentTierValue > xpTiers[existingEntry.tier]) {
      highestTierMap[label.name] = label;
    }
  });

  return Object.values(highestTierMap);
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

  let hasPassed = true;

  const msg: string[] = [];

  for (const labelFilter of normalizedLabelFilters) {
    if (!normalizedUserLanguages.has(labelFilter)) {
      const logMessage = logger.error(`${user} does not have the required language for: ${labelFilter}`);
      msg.push(logMessage?.logMessage.diff as string);
      hasPassed = false;
      continue;
    }

    const userLang = Array.from(userLanguages).find(({ name }) => name === labelFilter);
    if (!userLang) {
      const logMessage = logger.error(`${user} failed to pass the required language guard for ${labelFilter}`);
      hasPassed = false;
      msg.push(logMessage?.logMessage.diff as string);
      continue;
    }

    const tier = labelFilters.find(({ name }) => name === labelFilter)?.tier || "n/a";

    if (tier === "n/a") {
      logger.info("No label guard found, skipping...");
      // TODO: could have more robust handling depending on ranks etc but needs thought out
      continue;
    }

    const tierValue = xpTiers[tier];
    if (!tierValue) {
      const logMessage = logger.error(`No tier value found for ${tier}`);
      msg.push(logMessage?.logMessage.diff as string);
      hasPassed = false;
      continue;
    }

    if (userLang && userLang.percentage < tierValue) {
      const logMessage = logger.error(`${user} does not meet the required tier for ${labelFilter.charAt(0).toUpperCase() + labelFilter.slice(1)}`);
      hasPassed = false;
      msg.push(logMessage?.logMessage.diff as string);
    } else if (!userLang) {
      const logMessage = logger.error(`${user} does not have the required language for: ${labelFilter.charAt(0).toUpperCase() + labelFilter.slice(1)}`);
      hasPassed = false;
      msg.push(logMessage?.logMessage.diff as string);
    }
  }

  if (hasPassed) {
    logger.info(`${user} has passed the required language guards for ${normalizedLabelFilters.join(", ")}`);
  } else {
    logger.error(`${user} has failed the required language guards: `, {
      userLanguages: Array.from(userLanguages),
      labelFilters,
    });
  }

  return { hasPassed, msg };
}

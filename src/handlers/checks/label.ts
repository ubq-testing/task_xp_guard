import { Context } from "../../types";
import { addCommentToIssue } from "../../shared/comment";
import { fetchTopLanguages } from "../fetching/fetch-language-stats";

export async function handleLabelChecks(context: Context, token: string, configLabelFilters: string[], xpTiers: Record<string, number>, user: string) {
  const { logger } = context;
  const langs = await fetchTopLanguages(user, token);
  const normalizedUserLanguages = new Set(
    Object.values(langs).map((lang) => {
      return {
        name: lang.name.toLowerCase(),
        percentage: lang.percentage || 0,
      };
    })
  );
  const issueLabels = context.payload.issue.labels
    ?.map((label) => {
      const rankCaptureRegex = /\(([^)]+)\)/;
      if (label.name.includes(":")) {
        return {
          name: label.name.split(":")[0].toLowerCase(),
          tier: rankCaptureRegex.exec(label.name)?.[1]?.toLowerCase() || "n/a",
        };
      }
    })
    .filter((label) => label !== undefined);

  // find the label we wish to use as our guard
  const labelFilters_ = issueLabels?.filter((label) => configLabelFilters.some((filter) => filter.toLowerCase() === label?.name));

  if (!labelFilters_?.length) {
    logger.info(`No label guard found for ${user}`);
    return true;
  }

  const msg: string[] = [];

  const { highestTieredDuplicates, msg: duplicateMsgs } = await findAndRemoveDuplicateFilters(labelFilters_, xpTiers);
  const checked = await checkLabelGuards(context, normalizedUserLanguages, highestTieredDuplicates, xpTiers, user);

  if (duplicateMsgs.length > 0 || checked.msg.length > 0) {
    msg.push(duplicateMsgs.join(""));
    if (msg.length > 0) {
      msg.push(checked.msg.join(", "));
    } else {
      msg.push(`\`\`\`diff\n${checked.msg.join(", ")}`);
    }
    await addCommentToIssue(context, msg.join("\n"));
  }

  return checked.hasPassed;
}

async function findAndRemoveDuplicateFilters(labelFilters: { name: string; tier: string }[], xpTiers: Record<string, number>) {
  const highestTierMap: Record<string, { name: string; tier: string }> = {};

  const msg: string[] = ["```diff\n! Duplicate filters found, defaulting to the highest tiered: "];
  let count = 0;
  labelFilters.forEach((label) => {
    const currentTierValue = xpTiers[label.tier];
    const name = label.name.toLowerCase();
    const existingEntry = highestTierMap[name];

    if (!existingEntry) {
      highestTierMap[name] = label;
      return;
    }

    const existingTierValue = xpTiers[existingEntry.tier];

    if (currentTierValue > existingTierValue) {
      highestTierMap[name] = label;
      count++;
      msg.push(`\n- ${name} (${label.tier})`);
    } else if (currentTierValue <= existingTierValue) {
      count++;
      msg.push(`\n- ${name} (${existingEntry.tier})`);
    }
  });

  return {
    highestTieredDuplicates: Object.values(highestTierMap),
    msg: count > 0 ? msg : [],
  };
}

async function checkLabelGuards(
  context: Context,
  userLanguages: Set<{ name: string; percentage: number }>,
  labelFilters: { name: string; tier: string }[],
  xpTiers: Record<string, number>,
  user: string
) {
  const { logger } = context;

  const labelTierMap = new Map(labelFilters.map(({ name, tier }) => [name, tier]));
  const userLanguageMap = new Map(Array.from(userLanguages).map(({ name, percentage }) => [name, percentage]));

  let hasPassed = true;
  const msg: string[] = [];

  for (const labelFilter of labelFilters.map(({ name }) => name)) {
    const userLangPercentage = userLanguageMap.get(labelFilter);

    if (!userLangPercentage) {
      const logMessage = logger.error(`${user} does not have the required language for: ${labelFilter}`);
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
      hasPassed = false;
      continue;
    }

    const tier = labelTierMap.get(labelFilter) || "n/a";

    if (tier === "n/a") {
      logger.info("No label guard found, skipping...");
      continue;
    }

    const tierValue = xpTiers[tier];
    if (!tierValue) {
      const logMessage = logger.error(`No tier value found for ${labelFilter}/${tier}`);
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
      hasPassed = false;
      continue;
    }

    if (userLangPercentage < tierValue) {
      const logMessage = logger.error(`${user} does not meet the required tier for ${labelFilter.charAt(0).toUpperCase() + labelFilter.slice(1)}`);
      hasPassed = false;
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
    }
  }

  logger.info(`${user} has ${hasPassed ? "passed" : "failed"} the required language guards: `, {
    userLanguages: Array.from(userLanguages),
    labelFilters,
  });

  return { hasPassed, msg };
}

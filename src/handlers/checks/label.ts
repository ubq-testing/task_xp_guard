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

  const { highestTieredDuplicates, msg: duplicateMsgs } = await findAndRemoveDuplicateFilters(labelFilters_, xpTiers);
  const checked = await checkLabelGuards(context, userLanguages, highestTieredDuplicates, xpTiers, user);

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
    const existingEntry = highestTierMap[label.name];

    if (!existingEntry) {
      highestTierMap[label.name] = label;
      return;
    }

    const existingTierValue = xpTiers[existingEntry.tier];

    if (currentTierValue > existingTierValue) {
      highestTierMap[label.name] = label;
      count++;
      msg.push(`\n- ${label.name} (${label.tier})`);
    } else if (currentTierValue <= existingTierValue) {
      count++;
      msg.push(`\n- ${label.name} (${existingEntry.tier})`);
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

  const normalizedLabelFilters = labelFilters.map(({ name }) => name.toLowerCase());
  const normalizedUserLanguages = new Set(Array.from(userLanguages).map(({ name }) => name));

  let hasPassed = true;

  const msg: string[] = [];

  for (const labelFilter of normalizedLabelFilters) {
    if (!normalizedUserLanguages.has(labelFilter)) {
      const logMessage = logger.error(`${user} does not have the required language for: ${labelFilter}`);
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
      hasPassed = false;
      continue;
    }

    const userLang = Array.from(userLanguages).find(({ name }) => name === labelFilter);
    if (!userLang) {
      const logMessage = logger.error(`${user} failed to pass the required language guard for ${labelFilter}`);
      hasPassed = false;
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
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
      const logMessage = logger.error(`No tier value found for ${labelFilter}/${tier}`);
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
      hasPassed = false;
      continue;
    }

    if (userLang && userLang.percentage < tierValue) {
      const logMessage = logger.error(`${user} does not meet the required tier for ${labelFilter.charAt(0).toUpperCase() + labelFilter.slice(1)}`);
      hasPassed = false;
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
    } else if (!userLang) {
      const logMessage = logger.error(`${user} does not have the required language for: ${labelFilter.charAt(0).toUpperCase() + labelFilter.slice(1)}`);
      hasPassed = false;
      msg.push(`\n! ${logMessage?.logMessage.raw}`);
    }
  }

  if (hasPassed) {
    logger.info(`${user} has passed the required language guards for ${normalizedLabelFilters.join(", ")}`, {
      userLanguages: Array.from(userLanguages),
      labelFilters,
    });
  } else {
    logger.error(`${user} has failed the required language guards: `, {
      userLanguages: Array.from(userLanguages),
      labelFilters,
    });
  }

  return { hasPassed, msg };
}

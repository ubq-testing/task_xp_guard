
import { Context } from "../../types";
import { addCommentToIssue } from "../../shared/comment";
import { fetchTopLanguages } from "../fetching/fetch-language-stats";

export async function handleLabelChecks(
    context: Context,
    token: string,
    labelFilters: string[],
    xpTiers: Record<string, number>,
    user: string
) {
    const { logger } = context;
    const langs = await fetchTopLanguages(user, token);
    const userLanguages = new Set(Object.values(langs).map((lang) => {
        return {
            name: lang.name.toLowerCase(),
            percentage: lang.percentage
        }
    }));
    const issueLabels = context.payload.issue.labels.map((label) => {
        const rankCaptureRegex = /\(([^)]+)\)/;
        return {
            name: label.name.split(":")[0].toLowerCase(),
            tier: rankCaptureRegex.exec(label.name)?.[1]?.toLowerCase() || "n/a"
        };
    });

    // find the label we wish to use as our guard
    const labelFilters_ = issueLabels
        .filter((label) => labelFilters.some((filter) => filter.toLowerCase() === label.name))

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
    userLanguages: Set<{ name: string, percentage: number }>,
    labelFilters_: { name: string, tier: string }[],
    xpTiers: Record<string, number>,
    user: string
) {
    const { logger } = context;

    const normalizedLabelFilters = labelFilters_.map(({ name }) => name.toLowerCase());
    const normalizedUserLanguages = new Set(
        Array.from(userLanguages).map(({ name }) => name)
    );

    for (const labelFilter of normalizedLabelFilters) {
        if (!normalizedUserLanguages.has(labelFilter)) {
            const logMessage = `${user} does not have the required language ${labelFilter}`;
            logger.error(logMessage);
            await addCommentToIssue(context, logMessage);
            throw new Error(logMessage);
        }

        const userLang = Array.from(userLanguages).find(({ name }) => name === labelFilter)
        if (!userLang) {
            const logMessage = `${user} does not have the required language ${labelFilter}`;
            logger.error(logMessage);
            await addCommentToIssue(context, logMessage);
            throw new Error(logMessage);
        }

        const tier = labelFilters_.find(({ name }) => name === labelFilter)?.tier || 'n/a';

        if (tier === 'n/a') {
            logger.info('No label guard found, skipping...');
            return;
        }

        const tierValue = xpTiers[tier];
        if (!tierValue) {
            const logMessage = `No XP tier found for ${tier}`;
            logger.error(logMessage);
            await addCommentToIssue(context, logMessage);
            throw new Error(logMessage);
        }

        if (userLang.percentage < tierValue) {
            const logMessage = `${user} does not have the required percentage for ${labelFilter}`;
            logger.error(logMessage);
            await addCommentToIssue(context, logMessage);
            throw new Error(logMessage);
        }

    }
}
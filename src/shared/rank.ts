/**
 * Scales the user's stats to a percentile rank based
 * on the median of each stat and the weight given to each stat.
 * 
 * Does not include dollars-earned yet but will be added in the future.
 */
export function calculateRank({
    commits,
    prs,
    issues,
    reviews,
    stars,
    followers,
}: {
    all_commits: boolean;
    commits: number;
    prs: number;
    issues: number;
    reviews: number;
    stars: number;
    followers: number;
}) {
    const COMMITS_MEDIAN = 1000,
        COMMITS_WEIGHT = 2;
    const PRS_MEDIAN = 50,
        PRS_WEIGHT = 3;
    const ISSUES_MEDIAN = 25,
        ISSUES_WEIGHT = 1;
    const REVIEWS_MEDIAN = 2,
        REVIEWS_WEIGHT = 1;
    const STARS_MEDIAN = 50,
        STARS_WEIGHT = 4;
    const FOLLOWERS_MEDIAN = 10,
        FOLLOWERS_WEIGHT = 1;

    const TOTAL_WEIGHT = COMMITS_WEIGHT + PRS_WEIGHT + ISSUES_WEIGHT + REVIEWS_WEIGHT + STARS_WEIGHT + FOLLOWERS_WEIGHT;

    const rank =
        1 -
        (COMMITS_WEIGHT * exponentialCdf(commits / COMMITS_MEDIAN) +
            PRS_WEIGHT * exponentialCdf(prs / PRS_MEDIAN) +
            ISSUES_WEIGHT * exponentialCdf(issues / ISSUES_MEDIAN) +
            REVIEWS_WEIGHT * exponentialCdf(reviews / REVIEWS_MEDIAN) +
            STARS_WEIGHT * logNormalCdf(stars / STARS_MEDIAN) +
            FOLLOWERS_WEIGHT * logNormalCdf(followers / FOLLOWERS_MEDIAN)) /
        TOTAL_WEIGHT;

    return Number((rank * 100).toFixed(2));
}

function exponentialCdf(x: number, lambda: number = 1) {
    return 1 - Math.exp(-lambda * x);
}

function logNormalCdf(x: number): number {
    return 0.5 * (1 + (x - 1) / Math.sqrt(1 + x * x));
}
import { graphqlFetchRetrier } from "../../shared/fetching-utils";
import { VALIDATED_GRAPHQL_QUERIES } from "../../shared/validate-queries";

export type Lang = {
  size: number;
  node: {
    name: string;
    color: string;
  };
  name?: string;
  count?: number;
  color?: string;
  percentage?: number;
};

export async function fetchTopLanguages(username: string, token: string): Promise<Lang[]> {
  const { user } = await graphqlFetchRetrier({ login: username }, token, VALIDATED_GRAPHQL_QUERIES.LANGS);

  if (!user) {
    return [];
  }
  if (!user.repositories) {
    return [];
  }

  // data taken from graphql query
  const langData = user?.repositories?.nodes
    ?.filter((repo) => (repo?.languages?.edges?.length || 0) > 0)
    .flatMap((repo) => repo?.languages?.edges)
    .filter((lang) => lang !== null && lang !== undefined) as Lang[];

  if (!langData || langData.length === 0) {
    return [];
  }

  const stats = langData.reduce(
    (acc, { size, node: { name, color } }) => {
      const key = name as keyof typeof acc;
      if (acc[key]) {
        acc[key].size += size;
        acc[key].count ? acc[key].count++ : (acc[key].count = 1);
        acc[key].color = color || acc[key].color;
      } else {
        acc[key] = { name: key, size, count: 1, color: color || "", node: { name, color: color || "" }, percentage: 0 };
      }
      return acc;
    },
    {} as Record<string, Required<Lang>>
  );

  if (!stats) {
    return [];
  }

  // weight the languages by size and count
  Object.values(stats).forEach((lang) => {
    lang.size = Math.pow(lang.size, 1) * Math.pow(lang.count || 0, 0);
  });

  // determine the total size of the languages
  const totalSize = Object.values(stats).reduce((acc, lang) => acc + lang.size, 0);

  // calculate the percentage of each language and drop any that are less than 1%
  return Object.values(stats)
    .map((lang) => {
      const percentage = parseFloat(((lang.size / totalSize) * 100).toFixed(2));
      return { ...lang, percentage };
    })
    .filter((lang) => lang.percentage > 1);
}

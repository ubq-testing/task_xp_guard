import { graphqlFetchRetrier } from "../../shared/fetching-utils";
import { GRAPHQL_QUERIES } from "../../shared/queries";

export type Lang = {
  name: string;
  size: number;
  count: number;
  color: string;
  percentage?: number;
};

export async function fetchTopLanguages(username: string, token: string): Promise<Lang[]> {
  const { user } = await graphqlFetchRetrier({ login: username }, token, GRAPHQL_QUERIES.LANGS);

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
    .filter((lang) => lang !== null && lang !== undefined)
    .reduce(
      (acc, { size, node: { name, color } }) => {
        const key = name as keyof typeof acc;
        if (acc[key]) {
          acc[key].size += size;
          acc[key].count += 1;
          acc[key].color = color || acc[key].color;
        } else {
          acc[key] = { name: key, size, count: 1, color: color || "" };
        }
        return acc;
      },
      {} as Record<string, Lang>
    );

  if (!langData) {
    return [];
  }

  // weight the languages by size and count
  Object.values(langData).forEach((lang) => {
    lang.size = Math.pow(lang.size, 1) * Math.pow(lang.count, 0);
    return lang;
  });

  // determine the total size of the languages
  const totalSize = Object.values(langData).reduce((acc, lang) => acc + lang.size, 0);

  // calculate the percentage of each language and drop any that are less than 1%
  return Object.values(langData)
    .map((lang) => {
      const percentage = parseFloat(((lang.size / totalSize) * 100).toFixed(2));
      return { ...lang, percentage };
    })
    .filter((lang) => lang.percentage > 1);
}

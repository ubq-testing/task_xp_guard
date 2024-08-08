import { graphqlFetchRetrier } from "../../shared/fetching-utils";
import { Langs } from "../../types/shared";

export async function fetchTopLanguages(username: string, token: string, sizeWeight = 1, countWeight = 0) {
  const { user } = await graphqlFetchRetrier({ login: username }, token);

  const langData = user.repositories.nodes
    .filter((repo) => repo.languages.edges.length > 0)
    .flatMap((repo) => repo.languages.edges)
    .reduce(
      (acc, { size, node: { name, color } }) => {
        const key = name as keyof typeof acc;
        if (acc[key]) {
          acc[key].size += size;
          acc[key].count += 1;
          acc[key].color = color;
        } else {
          acc[key] = { name: key, size, count: 1, color };
        }
        return acc;
      },
      {} as Record<string, Langs>
    );

  Object.values(langData).forEach((lang) => {
    lang.size = Math.pow(lang.size, sizeWeight) * Math.pow(lang.count, countWeight);
  });

  const assorted = Object.keys(langData)
    .sort((a, b) => langData[b].size - langData[a].size)
    .reduce(
      (result, key) => {
        result[key as keyof typeof result] = langData[key];
        return result;
      },
      {} as Record<string, Langs>
    );

  const totalSize = Object.values(assorted).reduce((acc, lang) => acc + lang.size, 0);
  return Object.values(assorted).map((lang) => {
    const percentage = parseFloat(((lang.size / totalSize) * 100).toFixed(2));
    return { ...lang, percentage };
  });
}

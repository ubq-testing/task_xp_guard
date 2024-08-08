type Language = {
  size: number;
  node: {
    color: string;
    name: string;
  };
};

type Languages = {
  edges: Language[];
};

type Repo = {
  name: string;
  languages: Languages;
  stargazers: { totalCount: number };
};

type User = {
  repositories: {
    nodes: Repo[];
  };
};

export type UserResponse = {
  user: User;
};

export type Langs = {
  name: string;
  size: number;
  count: number;
  color: string;
};

export type StatsResponse = {
  user: {
    login: string;
    contributionsCollection: {
      totalCommitContributions: number;
      totalPullRequestReviewContributions: number;
    };
    repositoriesContributedTo: { totalCount: number };
    pullRequests: { totalCount: number };
    mergedPullRequests: { totalCount: number };
    openIssues: { totalCount: number };
    closedIssues: { totalCount: number };
    followers: { totalCount: number };
    repositories: {
      totalCount: number;
      nodes: Repo[];
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  };
};

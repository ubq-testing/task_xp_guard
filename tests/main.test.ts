import { drop } from "@mswjs/data";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach, it } from "@jest/globals";
import { Context } from "../src/types/context";
import { Octokit } from "@octokit/rest";
import { STRINGS } from "./__mocks__/strings";
import { createIssue, setupTests } from "./__mocks__/helpers";
import manifest from "../manifest.json";
import dotenv from "dotenv";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { runPlugin } from "../src/plugin";

dotenv.config();
jest.requireActual("@octokit/rest");
jest.mock("../src/shared/fetching-utils", () => {
  return {
    graphqlFetchRetrier: jest.fn(),
  };
});
jest.mock("../src/shared/validate-queries", () => {
  return {
    VALIDATED_GRAPHQL_QUERIES: {
      LANGS: `
      query userInfo($login: String!) {
        user(login: $login) {
          repositories(ownerAffiliations: [OWNER, COLLABORATOR], isFork: false, first: 100) {
            nodes {
              name
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    color
                    name
                  }
                }
              }
            }
          }
        }
      }
    `,
      REPOS: `
  query userInfo($login: String!, $after: String) {
    user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}, after: $after) {
        totalCount
        nodes {
          name
          stargazers {
            totalCount
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
    `,
      STATS: `
  query userInfo($login: String!, $after: String, $includeMergedPullRequests: Boolean!) {
    user(login: $login) {
      name
      login
      contributionsCollection {
        totalCommitContributions,
        totalPullRequestReviewContributions
      }
      repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
        totalCount
      }
      pullRequests(first: 1) {
        totalCount
      }
      mergedPullRequests: pullRequests(states: MERGED) @include(if: $includeMergedPullRequests) {
        totalCount
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      closedIssues: issues(states: CLOSED) {
        totalCount
      }
      followers {
        totalCount
      }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}, after: $after) {
        totalCount
        nodes {
          name
          stargazers {
            totalCount
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`,
    },
  };
});

const octokit = new Octokit();
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

describe("Plugin tests", () => {
  beforeEach(async () => {
    drop(db);
    await setupTests();
  });

  it("Should serve the manifest file", async () => {
    const worker = (await import("../src/worker")).default;
    const response = await worker.fetch(new Request("http://localhost/manifest.json"));
    const content = await response.json();
    expect(content).toEqual(manifest);
  });

  it("Should skips checks for org member", async () => {
    const { context, infoSpy } = createContext();
    await expect(runPlugin(context, process.env.GITHUB_TOKEN as string)).resolves.not.toThrow();
    expect(infoSpy).toHaveBeenCalledWith("user2 is a member of the organization, skipping experience checks");
  });

  it("Should remove assignee after failing age check", async () => {
    createIssue("title", "body", 3, ["Solidity: (Mid)"], { login: "user3", id: 3 });
    const { context, infoSpy, errorSpy, issue } = createContext(1, 3, 3);
    expect(issue.assignee).toBeDefined();
    expect(issue.assignee?.login).toBe("user3");

    await expect(runPlugin(context, process.env.GITHUB_TOKEN as string)).resolves.not.toThrow();
    expect(infoSpy).toHaveBeenCalledWith("Checking user3's experience");
    expect(infoSpy).toHaveBeenCalledWith("user3 has not passed the experience check");
    expect(infoSpy).toHaveBeenCalledWith("user3 failed the experience check, removing...");
    expect(errorSpy).toHaveBeenCalledWith("user3 has not met the minimum account age requirement of 365 days");

    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 3 } } });
    expect(updatedIssue?.assignee).toBeNull();
  });

  it("Should remove org-member assignee after failing language check", async () => {
    createIssue("title", "body", 3, ["Solidity: (Mid)"], { login: "user2", id: 2 });
    const { context, infoSpy, issue } = createContext(1, 2, 3, true);
    expect(issue.assignee).toBeDefined();
    expect(issue.assignee?.login).toBe("user2");

    const { graphqlFetchRetrier } = jest.requireMock("../src/shared/fetching-utils");
    graphqlFetchRetrier
      .mockResolvedValueOnce({
        user: {
          repositories: {
            nodes: [
              {
                name: "repo1",
                languages: {
                  edges: [
                    {
                      size: 10000,
                      node: {
                        name: "Solidity",
                        color: "#000000",
                      },
                    },
                    {
                      size: 100000,
                      node: {
                        name: "Typescript",
                        color: "#000000",
                      },
                    },
                    {
                      size: 10000,
                      node: {
                        name: "Javascript",
                        color: "#000000",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        user: {
          repositories: {
            nodes: [
              {
                name: "repo1",
                stargazers: {
                  totalCount: 1,
                },
              },
            ],
          },
          contributionsCollection: {
            totalCommitContributions: 1,
            totalPullRequestReviewContributions: 1,
          },
          repositoriesContributedTo: {
            totalCount: 1,
          },
          pullRequests: {
            totalCount: 1,
          },
          mergedPullRequests: {
            totalCount: 1,
          },
          openIssues: {
            totalCount: 1,
          },
          closedIssues: {
            totalCount: 1,
          },
          followers: {
            totalCount: 1,
          },
        },
      });
    await expect(runPlugin(context, process.env.GITHUB_TOKEN as string)).resolves.not.toThrow();
    expect(infoSpy).toHaveBeenCalledWith("Checking user2's experience");
    expect(infoSpy).toHaveBeenCalledWith("user2 has failed the required language guards: ", {
      caller: "_Logs.<anonymous>",
      labelFilters: [{ name: "solidity", tier: "mid" }],
      userLanguages: [
        { name: "solidity", percentage: 8.33 },
        { name: "typescript", percentage: 83.33 },
        { name: "javascript", percentage: 8.33 },
      ],
    });
    expect(infoSpy).toHaveBeenCalledWith("user2 failed the experience check, removing...");
  });
});

function createContext(repoId: number = 1, payloadSenderId: number = 1, issueId: number = 1, checksForMembers = false) {
  const repo = db.repo.findFirst({ where: { id: { equals: repoId } } }) as unknown as Context["payload"]["repository"];
  const sender = db.users.findFirst({ where: { id: { equals: payloadSenderId } } }) as unknown as Context["payload"]["sender"];
  const issue = db.issue.findFirst({ where: { id: { equals: issueId } } }) as unknown as Context["payload"]["issue"];

  const context = createContextInner(repo, sender, issue, checksForMembers);
  const infoSpy = jest.spyOn(context.logger, "info");
  const errorSpy = jest.spyOn(context.logger, "error");
  const debugSpy = jest.spyOn(context.logger, "debug");
  const okSpy = jest.spyOn(context.logger, "ok");
  const verboseSpy = jest.spyOn(context.logger, "verbose");

  return {
    context,
    infoSpy,
    errorSpy,
    debugSpy,
    okSpy,
    verboseSpy,
    repo,
    issue,
  };
}

/**
 * Creates the context object central to the plugin.
 *
 * This should represent the active `SupportedEvents` payload for any given event.
 */
function createContextInner(
  repo: Context["payload"]["repository"],
  sender: Context["payload"]["sender"],
  issue: Context["payload"]["issue"],
  checksForMembers: boolean
): Context {
  return {
    eventName: "issues.assigned",
    payload: {
      action: "assigned",
      sender: sender,
      repository: repo,
      issue: issue,
      installation: { id: 1 } as Context["payload"]["installation"],
      organization: { login: STRINGS.USER_1 } as Context["payload"]["organization"],
    },
    logger: new Logs("debug"),
    config: {
      enableChecksForOrgMembers: checksForMembers,
      labelFilters: ["Solidity", "typescript"],
      xpTiers: {
        junior: 5,
        mid: 10,
        senior: 15,
      },
      minAccountAgeInDays: 365,
      statThresholds: {
        issues: 1,
        minCommits: 1,
        prs: 1,
        stars: 1,
      },
    },
    octokit: octokit,
  };
}

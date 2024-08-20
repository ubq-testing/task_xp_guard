import { SupportedEvents, SupportedEventsU } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";
import { User } from "@octokit/graphql-schema";

export type UserStats = Pick<User, "pullRequests" | "repositoriesContributedTo" | "repositories" | "followers" | "contributionsCollection"> & {
  openIssues: { totalCount: number };
  closedIssues: { totalCount: number };
  mergedPullRequests: { totalCount: number };
};

export interface PluginInputs<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  stateId: string;
  eventName: T;
  eventPayload: TU["payload"];
  settings: PluginSettings;
  authToken: string;
  ref: string;
}

const HALF_YEAR = 365 / 2;

export const pluginSettingsSchema = T.Object(
  {
    /**
     * By default we don't check org members. Enable this
     * to check org members as well.
     */
    enableChecksForOrgMembers: T.Boolean({ default: false }),
    minAccountAgeInDays: T.Number({ default: HALF_YEAR }), // Minimum account age in days,
    /**
     * Labels that indicate what to guard.
     * i.e "Solidity"
     * Full issue label would be "Solidity: (arbitrary string)"
     */
    labelFilters: T.Transform(T.Union([T.Array(T.String()), T.Record(T.String(), T.String())])).Decode((v) => {
      if (Array.isArray(v)) {
        return v;
      }
      return Object.values(v);
    }).Encode((v) => v),
    /**
     * XP tiers for the user. These should map directly to your
     * labelling schema (i.e. "Junior", "Mid", "Pro", "Level 1", "Level 2", etc)
     */
    xpTiers: T.Record(T.String(), T.Number(), {
      default: {
        Junior: 5,
        Mid: 20,
        Pro: 50,
      },
    }),
    statThresholds: T.Object(
      {
        stars: T.Number({ default: 1 }), // Minimum number of stars
        minCommits: T.Number({ default: 1 }), // Minimum number of commits
        prs: T.Number({ default: 1 }), // Minimum number of PRs
        issues: T.Number({ default: 1 }), // Minimum number of issues
      },
      {
        default: {},
      }
    ),
  },
  {
    default: {},
  }
);

export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;

import { SupportedEvents, SupportedEventsU } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";
import { User } from "@octokit/graphql-schema";

export type UserStats = User & {
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

export const pluginSettingsSchema = T.Object(
  {
    minAccountAgeInDays: T.Number(), // Minimum account age in days,
    /**
     * Labels that indicate what to guard.
     * i.e "Solidity"
     * Full issue label would be "Solidity: (arbitrary string)"
     */
    labelFilters: T.Array(T.String()),
    /**
     * XP tiers for the user. These should map directly to your
     * labelling schema (i.e. "Junior", "Mid", "Pro", "Level 1", "Level 2", etc)
     */
    xpTiers: T.Record(T.String(), T.Number()),
    statThresholds: T.Object({
      stars: T.Number(), // Minimum number of stars
      minCommitsThisYear: T.Number(), // Minimum number of commits
      prs: T.Number(), // Minimum number of PRs
      issues: T.Number(), // Minimum number of issues
    }),
  },
  {
    default: {
      minAccountAgeInDays: 365,
      labelFilters: ["Solidity"],
      xpTiers: {
        "N/A": 0,
        Junior: 5,
        Mid: 20,
        Pro: 50,
      },
      statThresholds: {
        stars: 1,
        minCommitsThisYear: 1,
        prs: 1,
        issues: 1,
      },
    },
  }
);

export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;

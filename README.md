# `@ubiquibot/task-xp-guard`

This plugin orchestrates task assignments by validating user experience and metadata against predefined criteria, ensuring that only qualified users are assigned to specific tasks.

## Features

- **Label and Metadata-Based Guarding:** Utilizes both issue labels (e.g., "Solidity: (Junior)") and user metadata (account age, stars, PRs, issues, commits) to determine task eligibility.
- **Flexible Configuration:** Supports multiple label filters and custom experience tiers for versatile issue protection.
- **Organization Member Bypass:** Allows bypassing experience checks for organization members, configurable per organization policy.

## Usage

- **Issue Labeling:** Apply labels to issues such as `Solidity: (Junior)` or `TypeScript: (Senior)` to categorize tasks by required experience.
- **Label Filters:** Configure `labelFilters` in the plugin settings to correspond with the issue labels used for task protection.
- **Experience Tiers:** Specify `xpTiers` in the plugin settings, linking these to the rank specified in your issue labels.
- **Metadata Thresholds:** Establish `statThresholds` to safeguard against simple spoofing attempts and ensure a genuine user qualification based on profile metadata.

## How It Works

- **Language Proficiency Evaluation:** Analyzes a contributor's GitHub profile to assess proficiency based on their repositories and contributions.
- **Metadata Verification:** Calculates experience based on vital account statistics including age, stars, PRs, issues, and commits.
- **Label Filtering Process:** Matches issue labels against defined filters to verify if a user meets the necessary experience criteria.
- **Conditional Assignee Management:** Automatically removes assignees who fail to meet the specified experience requirements, maintaining the integrity of task assignments.

## Configuration Example

```yml
enableChecksForOrgMembers: false  # Set to true to bypass checks for organization members
minAccountAgeInDays: 365         # Minimum account age required to qualify for task assignments
labelFilters:
  - Solidity                     # Labels used to identify protected tasks
xpTiers:
  Junior: 10                     # Percentage threshold for qualificationm, e.g., 10% of total languages
                                 # (user's language count / total language count across all repos) * 100.
statThresholds:
  stars: 10                      # Minimum stars required
  prs: 5                         # Minimum PRs required
  issues: 5                      # Minimum issues required
  commits: 5                     # Minimum commits required

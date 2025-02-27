// cSpell:disable
import { factory, nullable, primaryKey } from "@mswjs/data";

/**
 * Creates an object that can be used as a db to persist data within tests
 */
export const db = factory({
  users: {
    id: primaryKey(Number),
    name: String,
    login: String,
    created_at: Date,
  },
  issue: {
    id: primaryKey(Number),
    assignees: Array,
    html_url: String,
    repository_url: String,
    state: String,
    owner: String,
    repo: String,
    labels: Array,
    body: nullable(String),
    closed_at: nullable(Date),
    created_at: nullable(Date),
    comments: Number,
    comments_url: String,
    events_url: String,
    labels_url: String,
    locked: Boolean,
    node_id: String,
    title: String,
    number: Number,
    updated_at: Date,
    url: String,
    user: nullable(Object),
    milestone: nullable(Object),
    assignee: nullable({
      avatar_url: String,
      email: nullable(String),
      events_url: String,
      followers_url: String,
      following_url: String,
      gists_url: String,
      gravatar_id: nullable(String),
      html_url: String,
      id: Number,
      login: String,
      name: nullable(String),
      node_id: String,
      organizations_url: String,
      received_events_url: String,
      repos_url: String,
      site_admin: Boolean,
      starred_at: String,
      starred_url: String,
      subscriptions_url: String,
      type: String,
      url: String,
    }),
  },
  repo: {
    id: primaryKey(Number),
    html_url: String,
    name: String,
    labels: Array,
    owner: {
      login: String,
      id: Number,
    },
    issues: Array,
  },
  issueComments: {
    id: primaryKey(Number),
    body: String,
    created_at: Date,
    updated_at: Date,
    issue_number: Number,
    user: {
      login: String,
      id: Number,
    },
  },
});

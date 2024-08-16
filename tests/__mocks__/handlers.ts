import { http, HttpResponse } from "msw";
import { db } from "./db";
import issueTemplate from "./issue-template";
/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  // get org repos
  http.get("https://api.github.com/orgs/:org/repos", ({ params: { org } }: { params: { org: string } }) =>
    HttpResponse.json(db.repo.findMany({ where: { owner: { login: { equals: org } } } }))
  ),
  // get org repo issues
  http.get("https://api.github.com/repos/:owner/:repo/issues", ({ params: { owner, repo } }) =>
    HttpResponse.json(db.issue.findMany({ where: { owner: { equals: owner as string }, repo: { equals: repo as string } } }))
  ),
  // get issue
  http.get("https://api.github.com/repos/:owner/:repo/issues/:issue_number", ({ params: { owner, repo, issue_number: issueNumber } }) =>
    HttpResponse.json(
      db.issue.findFirst({ where: { owner: { equals: owner as string }, repo: { equals: repo as string }, number: { equals: Number(issueNumber) } } })
    )
  ),
  // get user
  http.get("https://api.github.com/users/:username", ({ params: { username } }) =>
    HttpResponse.json(db.users.findFirst({ where: { login: { equals: username as string } } }))
  ),
  // get repo
  http.get("https://api.github.com/repos/:owner/:repo", ({ params: { owner, repo } }: { params: { owner: string; repo: string } }) => {
    const item = db.repo.findFirst({ where: { name: { equals: repo }, owner: { login: { equals: owner } } } });
    if (!item) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(item);
  }),
  // create issue
  http.post("https://api.github.com/repos/:owner/:repo/issues", () => {
    const id = db.issue.count() + 1;
    const newItem = { ...issueTemplate, id };
    db.issue.create(newItem);
    return HttpResponse.json(newItem);
  }),
  // get collaborator permission level
  http.get("https://api.github.com/repos/:owner/:repo/collaborators/:username/permission", ({ params: { username } }) => {
    switch (username) {
      case "ubiquity":
        return HttpResponse.json({ permission: "admin" });
      case "user2":
        return HttpResponse.json({ permission: "write" });
      case "user3":
        return HttpResponse.json({ permission: "read" });
      default:
        return HttpResponse.json({ permission: "none" });
    }
  }),

  // get membership
  http.get("https://api.github.com/orgs/:org/memberships/:username", ({ params: { username } }) => {
    switch (username) {
      case "ubiquity":
        return HttpResponse.json({ role: "admin" });
      case "user2":
        return HttpResponse.json({ role: "member" });
      case "user3":
        return HttpResponse.json({ role: "contributor" });
      default:
        return new HttpResponse(null, { status: 404 });
    }
  }),
  // create comment
  http.post("https://api.github.com/repos/:owner/:repo/issues/:issue_number/comments", async ({ params, request }) => {
    const { issue_number: issueNumber } = params;
    const body = await getValue(request.body);
    if (body) {
      db.issueComments.create({
        id: db.issueComments.count() + 1,
        body: body.comment,
        issue_number: Number(issueNumber),
        user: {
          login: "ubiquibot[bot]",
          id: 4,
        },
      });
    }
    return HttpResponse.json({});
  }),
  // remove assignee
  http.delete("https://api.github.com/repos/:owner/:repo/issues/:issue_number/assignees", async ({ params: { issue_number: issueNumber, owner, repo } }) => {
    db.issue.update({
      where: { owner: { equals: owner as string }, repo: { equals: repo as string }, id: { equals: Number(issueNumber) } },
      data: { assignee: null, assignees: [] },
    });
    return HttpResponse.json({});
  }),
];

async function getValue(body: ReadableStream<Uint8Array> | null) {
  if (body) {
    const reader = body.getReader();
    const streamResult = await reader.read();
    if (!streamResult.done) {
      const text = new TextDecoder().decode(streamResult.value);
      try {
        return JSON.parse(text);
      } catch (error) {
        console.error("Failed to parse body as JSON", error);
      }
    }
  }
}

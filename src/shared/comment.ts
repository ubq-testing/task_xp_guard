import { Context } from "../types";

export async function addCommentToIssue(context: Context, comment: string) {
  const { octokit, payload } = context;
  try {
    await octokit.rest.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: comment,
    });
  } catch (error) {
    throw context.logger.error("Error adding comment to issue", { e: error }).logMessage.raw;
  }
}

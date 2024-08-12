import { Context } from "../../types";

export async function isOrgMember(context: Context, username?: string): Promise<boolean> {
  if (!username) return false;
  const permissionLevel = await getCollaboratorPermissionLevel(context, username);
  const membership = await getMembershipForUser(context, username);
  const allowedRoles = ["admin", "billing_manager", "owner", "member", "maintainer", "write"];
  return allowedRoles.includes(permissionLevel) || allowedRoles.includes(membership);
}

async function getCollaboratorPermissionLevel(context: Context, username: string) {
  const owner = context.payload.repository.owner?.login;
  if (!owner) throw context.logger.error("No owner found in the repository!");
  try {
    const response = await context.octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo: context.payload.repository.name,
      username,
    });
    return response.data.permission;
  } catch (err) {
    return "n/a";
  }
}

async function getMembershipForUser(context: Context, username: string) {
  if (!context.payload.organization) throw context.logger.error(`No organization found in payload!`);

  try {
    const { data: membership } = await context.octokit.rest.orgs.getMembershipForUser({
      org: context.payload.organization.login,
      username,
    });
    return membership.role;
  } catch (err) {
    return "n/a";
  }
}

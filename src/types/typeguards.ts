import { fetchManifestStartCommand } from "../shared/fetch-manifest";
import { Context } from "./context";

export async function isStartCommandEvent(context: Context): Promise<boolean> {
  const startCommand = await fetchManifestStartCommand(context);
  return context.eventName === "issue_comment.created" && context.payload.comment.body.match(new RegExp(`^/${startCommand}`)) !== null;
}

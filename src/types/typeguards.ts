import { Context } from "./context";

export function isStartCommandEvent(context: Context): context is Context<"issue_comment.created"> {
  return context.eventName === "issue_comment.created" && context.payload.comment.body.match(/\/start/) !== null;
}
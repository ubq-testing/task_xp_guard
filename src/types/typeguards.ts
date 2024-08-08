import { Context } from "./context";
import { StatsResponse, UserResponse } from "./shared";

export function isStartCommandEvent(context: Context): context is Context<"issue_comment.created"> {
  return context.eventName === "issue_comment.created" && context.payload.comment.body.match(/\/start/) !== null;
}

export function isUserResponse(res: UserResponse | StatsResponse): res is UserResponse {
  return "repositories" in res.user;
}

export function isStatsResponse(res: UserResponse | StatsResponse): res is StatsResponse {
  return "pullRequests" in res.user;
}

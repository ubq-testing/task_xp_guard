import { Context } from "../types";

export async function fetchManifestStartCommand(context: Context, repo: string = "command-start-stop", owner: string = "ubiquibot") {
  try {
    const manifest = await context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: "manifest.json",
      mediaType: {
        format: "json",
      },
    });
    const content = Buffer.from((manifest.data as { content: string }).content, "base64").toString("utf-8");
    const commands = JSON.parse(content).commands;
    /**
     * 'command-start-stop' has two commands, but in this case we know it's the first one.
     * If the order was ever to change we'd have no way to identify an arbitrary command.
     * so either it _must_ be the first command, or we need to add some kind of identifier to the command
     * such as 'original' | 'default' or something similar
     */
    return Object.keys(commands)[0];
  } catch (error) {
    throw context.logger.error("Error fetching manifest", { e: error })?.logMessage.raw;
  }
}

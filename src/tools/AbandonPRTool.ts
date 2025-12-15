import { GitPullRequest, PullRequestStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult } from "../types.js";

export interface AbandonPRParams {
  pr: string;
  organization?: string;
  project?: string;
  repository?: string;
}

export async function abandonPR(
  params: AbandonPRParams
): Promise<OperationResult<void>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    const update: GitPullRequest = {
      status: PullRequestStatus.Abandoned,
    };

    await gitApi.updatePullRequest(
      update,
      id.repository,
      id.pullRequestId,
      id.project
    );

    return {
      success: true,
      message: `Abandoned PR #${id.pullRequestId}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to abandon PR: ${message}`,
      error: "ABANDON_PR_FAILED",
    };
  }
}

// MCP Tool definition
export const AbandonPRToolDefinition = {
  name: "abandon_pr",
  description: "Abandon a pull request",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      organization: {
        type: "string",
        description: "Azure DevOps organization (optional, uses default)",
      },
      project: {
        type: "string",
        description: "Project name (optional, uses default)",
      },
      repository: {
        type: "string",
        description: "Repository name (optional, uses default)",
      },
    },
    required: ["pr"],
  },
};

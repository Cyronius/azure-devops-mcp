import { GitPullRequest } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult } from "../types.js";

export interface UpdatePRParams {
  pr: string;
  title?: string;
  description?: string;
  organization?: string;
  project?: string;
  repository?: string;
}

export async function updatePR(
  params: UpdatePRParams
): Promise<OperationResult<void>> {
  try {
    if (!params.title && !params.description) {
      return {
        success: false,
        message: "At least one of title or description is required",
        error: "INVALID_PARAMS",
      };
    }

    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    const update: GitPullRequest = {};
    if (params.title) update.title = params.title;
    if (params.description) update.description = params.description;

    await gitApi.updatePullRequest(
      update,
      id.repository,
      id.pullRequestId,
      id.project
    );

    const changes: string[] = [];
    if (params.title) changes.push("title");
    if (params.description) changes.push("description");

    return {
      success: true,
      message: `Updated PR #${id.pullRequestId}: ${changes.join(", ")}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to update PR: ${message}`,
      error: "UPDATE_PR_FAILED",
    };
  }
}

// MCP Tool definition
export const UpdatePRToolDefinition = {
  name: "update_pr",
  description: "Update a pull request's title and/or description",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      title: {
        type: "string",
        description: "New title for the PR",
      },
      description: {
        type: "string",
        description: "New description for the PR (supports markdown)",
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

import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { getUserId } from "../user-cache.js";
import { OperationResult } from "../types.js";

export interface RemoveReviewerParams {
  pr: string;
  email: string;
  organization?: string;
  project?: string;
  repository?: string;
}

export async function removeReviewer(
  params: RemoveReviewerParams
): Promise<OperationResult<void>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    // Get user ID from cache
    let userId = getUserId(params.email);

    if (!userId) {
      // Try to find the reviewer by email in the PR's current reviewers
      const gitApi = await getGitApi(id.organization);
      const pr = await gitApi.getPullRequest(
        id.repository,
        id.pullRequestId,
        id.project
      );

      const reviewer = pr.reviewers?.find(
        (r) => r.uniqueName?.toLowerCase() === params.email.toLowerCase()
      );

      if (reviewer?.id) {
        userId = reviewer.id;
      } else {
        return {
          success: false,
          message: `User not found: ${params.email}`,
          error: "USER_NOT_FOUND",
        };
      }
    }

    const gitApi = await getGitApi(id.organization);

    await gitApi.deletePullRequestReviewer(
      id.repository,
      id.pullRequestId,
      userId,
      id.project
    );

    return {
      success: true,
      message: `Removed reviewer: ${params.email}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to remove reviewer: ${message}`,
      error: "REMOVE_REVIEWER_FAILED",
    };
  }
}

// MCP Tool definition
export const RemoveReviewerToolDefinition = {
  name: "remove_reviewer",
  description: "Remove a reviewer from a pull request",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      email: {
        type: "string",
        description: "Reviewer's email address to remove",
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
    required: ["pr", "email"],
  },
};

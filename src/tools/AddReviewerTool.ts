import { IdentityRefWithVote } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { getUserId, cacheUserId } from "../user-cache.js";
import { OperationResult } from "../types.js";

export interface AddReviewerParams {
  pr: string;
  email: string;
  isRequired?: boolean;
  organization?: string;
  project?: string;
  repository?: string;
}

export interface AddReviewerResult {
  reviewerId: string;
  displayName: string;
}

export async function addReviewer(
  params: AddReviewerParams
): Promise<OperationResult<AddReviewerResult>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    // Get user ID from cache or throw
    let userId = getUserId(params.email);

    if (!userId) {
      // For now, we don't have Graph API integration
      // In future, could add: userId = await lookupUserByEmail(id.organization, params.email);
      return {
        success: false,
        message: `User not found in cache: ${params.email}. Known users: himanshu.mishra@lm-solutions.com, aviraj.singh@lm-solutions.com, josh.bonnell@sviworld.com, josh.attoun@sviworld.com, victoria.day@sviworld.com, gabe.priest@sviworld.com, nick.fritsche@sviworld.com, dayton.drilling@sviworld.com`,
        error: "USER_NOT_FOUND",
      };
    }

    const gitApi = await getGitApi(id.organization);

    const reviewer: IdentityRefWithVote = {
      id: userId,
      isRequired: params.isRequired !== false, // Default to required
    };

    const result = await gitApi.createPullRequestReviewer(
      reviewer,
      id.repository,
      id.pullRequestId,
      userId,
      id.project
    );

    if (!result) {
      return {
        success: false,
        message: "Failed to add reviewer - no result returned",
        error: "ADD_REVIEWER_FAILED",
      };
    }

    return {
      success: true,
      message: `Added ${params.isRequired !== false ? "required" : "optional"} reviewer: ${result.displayName || params.email}`,
      data: {
        reviewerId: userId,
        displayName: result.displayName || params.email,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to add reviewer: ${message}`,
      error: "ADD_REVIEWER_FAILED",
    };
  }
}

// MCP Tool definition
export const AddReviewerToolDefinition = {
  name: "add_reviewer",
  description: "Add a reviewer to a pull request by email address",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      email: {
        type: "string",
        description: "Reviewer's email address",
      },
      isRequired: {
        type: "boolean",
        description: "Whether the reviewer is required (default: true)",
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

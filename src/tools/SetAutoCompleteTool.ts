import { GitPullRequest } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult } from "../types.js";

export interface SetAutoCompleteParams {
  pr: string;
  enable: boolean;
  deleteSourceBranch?: boolean;
  squashMerge?: boolean;
  organization?: string;
  project?: string;
  repository?: string;
}

export async function setAutoComplete(
  params: SetAutoCompleteParams
): Promise<OperationResult<void>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    let update: GitPullRequest;

    if (params.enable) {
      // Get the PR to get the creator as the auto-complete setter
      const currentPR = await gitApi.getPullRequest(
        id.repository,
        id.pullRequestId,
        id.project
      );

      update = {
        autoCompleteSetBy: currentPR.createdBy,
        completionOptions: {
          deleteSourceBranch: params.deleteSourceBranch !== false,
          squashMerge: params.squashMerge || false,
        },
      };
    } else {
      // Cancel auto-complete by setting to null
      update = {
        autoCompleteSetBy: {
          id: undefined, // Setting to undefined cancels auto-complete
        },
      };
    }

    await gitApi.updatePullRequest(
      update,
      id.repository,
      id.pullRequestId,
      id.project
    );

    return {
      success: true,
      message: params.enable
        ? `Enabled auto-complete on PR #${id.pullRequestId}`
        : `Cancelled auto-complete on PR #${id.pullRequestId}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to set auto-complete: ${message}`,
      error: "SET_AUTO_COMPLETE_FAILED",
    };
  }
}

// MCP Tool definition
export const SetAutoCompleteToolDefinition = {
  name: "set_auto_complete",
  description: "Enable or cancel auto-complete on a pull request",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      enable: {
        type: "boolean",
        description: "true to enable auto-complete, false to cancel",
      },
      deleteSourceBranch: {
        type: "boolean",
        description: "Delete source branch when auto-completed (default: true)",
      },
      squashMerge: {
        type: "boolean",
        description: "Squash merge when auto-completed (default: false)",
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
    required: ["pr", "enable"],
  },
};

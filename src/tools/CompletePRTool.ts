import { GitPullRequest, PullRequestStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult } from "../types.js";

export interface CompletePRParams {
  pr: string;
  deleteSourceBranch?: boolean;
  squashMerge?: boolean;
  mergeCommitMessage?: string;
  bypassPolicy?: boolean;
  organization?: string;
  project?: string;
  repository?: string;
}

export async function completePR(
  params: CompletePRParams
): Promise<OperationResult<void>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    // First, get the PR to get the lastMergeSourceCommit
    const currentPR = await gitApi.getPullRequest(
      id.repository,
      id.pullRequestId,
      id.project
    );

    if (!currentPR.lastMergeSourceCommit?.commitId) {
      return {
        success: false,
        message: "Could not get last merge source commit - PR may have merge conflicts",
        error: "NO_MERGE_COMMIT",
      };
    }

    const update: GitPullRequest = {
      status: PullRequestStatus.Completed,
      lastMergeSourceCommit: {
        commitId: currentPR.lastMergeSourceCommit.commitId,
      },
      completionOptions: {
        deleteSourceBranch: params.deleteSourceBranch !== false, // Default true
        squashMerge: params.squashMerge || false,
        mergeCommitMessage: params.mergeCommitMessage,
        bypassPolicy: params.bypassPolicy || false,
      },
    };

    await gitApi.updatePullRequest(
      update,
      id.repository,
      id.pullRequestId,
      id.project
    );

    return {
      success: true,
      message: `Completed PR #${id.pullRequestId}${params.deleteSourceBranch !== false ? " (source branch deleted)" : ""}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to complete PR: ${message}`,
      error: "COMPLETE_PR_FAILED",
    };
  }
}

// MCP Tool definition
export const CompletePRToolDefinition = {
  name: "complete_pr",
  description: "Complete (merge) a pull request",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      deleteSourceBranch: {
        type: "boolean",
        description: "Delete source branch after merge (default: true)",
      },
      squashMerge: {
        type: "boolean",
        description: "Squash commits into a single commit (default: false)",
      },
      mergeCommitMessage: {
        type: "string",
        description: "Custom merge commit message",
      },
      bypassPolicy: {
        type: "boolean",
        description: "Bypass branch policies (use with caution, default: false)",
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

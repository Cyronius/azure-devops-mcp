import { GitPullRequest } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi, requireOrg, requireProject, requireRepo } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput, buildPRUrl } from "../url-parser.js";
import { OperationResult, PRDetails, ReviewerInfo, VoteLabels } from "../types.js";

export interface GetPRParams {
  pr: string;
  organization?: string;
  project?: string;
  repository?: string;
}

function formatReviewer(reviewer: any): ReviewerInfo {
  return {
    displayName: reviewer.displayName || "Unknown",
    email: reviewer.uniqueName || "",
    vote: VoteLabels[reviewer.vote] || "Unknown",
    voteNumber: reviewer.vote || 0,
    isRequired: reviewer.isRequired || false,
  };
}

function stripRefsHeads(ref: string | undefined): string {
  if (!ref) return "";
  return ref.replace(/^refs\/heads\//, "");
}

export async function getPR(params: GetPRParams): Promise<OperationResult<PRDetails>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);
    const pr: GitPullRequest = await gitApi.getPullRequest(
      id.repository,
      id.pullRequestId,
      id.project
    );

    if (!pr) {
      return {
        success: false,
        message: `PR #${id.pullRequestId} not found`,
        error: "PR_NOT_FOUND",
      };
    }

    const prDetails: PRDetails = {
      pullRequestId: pr.pullRequestId || id.pullRequestId,
      title: pr.title || "",
      description: pr.description || "",
      status: pr.status !== undefined ? ["notSet", "active", "abandoned", "completed", "all"][pr.status] || "unknown" : "unknown",
      isDraft: pr.isDraft || false,
      mergeStatus: pr.mergeStatus !== undefined ? ["notSet", "queued", "conflicts", "succeeded", "rejectedByPolicy", "failure"][pr.mergeStatus] || "unknown" : "unknown",
      sourceBranch: stripRefsHeads(pr.sourceRefName),
      targetBranch: stripRefsHeads(pr.targetRefName),
      createdBy: pr.createdBy?.displayName || "Unknown",
      createdByEmail: pr.createdBy?.uniqueName || "",
      creationDate: pr.creationDate?.toISOString() || "",
      reviewers: (pr.reviewers || []).map(formatReviewer),
      url: buildPRUrl(id),
    };

    return {
      success: true,
      message: `Retrieved PR #${prDetails.pullRequestId}: ${prDetails.title}`,
      data: prDetails,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to get PR: ${message}`,
      error: "GET_PR_FAILED",
    };
  }
}

// MCP Tool definition
export const GetPRToolDefinition = {
  name: "get_pr",
  description: "Get details of an Azure DevOps pull request by URL or ID",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description:
          "PR URL (https://dev.azure.com/org/project/_git/repo/pullrequest/123) or PR ID",
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

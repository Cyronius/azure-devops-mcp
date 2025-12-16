import { GitPullRequest } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi, requireOrg, requireProject, requireRepo } from "../connection.js";
import { getDefaults } from "../config.js";
import { OperationResult, PRDetails, ReviewerInfo, VoteLabels } from "../types.js";

export interface CreatePRParams {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  isDraft?: boolean;
  organization?: string;
  project?: string;
  repository?: string;
}

export async function createPR(
  params: CreatePRParams
): Promise<OperationResult<PRDetails>> {
  try {
    const defaults = getDefaults();
    const organization = requireOrg(params.organization, defaults.organization);
    const project = requireProject(params.project, defaults.project);
    const repository = requireRepo(params.repository, defaults.repository);

    const gitApi = await getGitApi(organization);

    // Ensure branch names have refs/heads/ prefix
    const sourceRef = params.sourceBranch.startsWith("refs/heads/")
      ? params.sourceBranch
      : `refs/heads/${params.sourceBranch}`;
    const targetRef = params.targetBranch.startsWith("refs/heads/")
      ? params.targetBranch
      : `refs/heads/${params.targetBranch}`;

    const prToCreate: GitPullRequest = {
      sourceRefName: sourceRef,
      targetRefName: targetRef,
      title: params.title,
      description: params.description || "",
      isDraft: params.isDraft ?? true, // Default to draft
    };

    const createdPR = await gitApi.createPullRequest(
      prToCreate,
      repository,
      project
    );

    if (!createdPR || !createdPR.pullRequestId) {
      return {
        success: false,
        message: "Failed to create pull request: No PR returned",
        error: "CREATE_PR_FAILED",
      };
    }

    // Build PR details response
    const reviewers: ReviewerInfo[] = (createdPR.reviewers || []).map((r) => ({
      displayName: r.displayName || "Unknown",
      email: r.uniqueName || "",
      vote: VoteLabels[r.vote || 0] || "No vote",
      voteNumber: r.vote || 0,
      isRequired: r.isRequired || false,
    }));

    const prDetails: PRDetails = {
      pullRequestId: createdPR.pullRequestId,
      title: createdPR.title || "",
      description: createdPR.description || "",
      status: createdPR.status?.toString() || "unknown",
      isDraft: createdPR.isDraft || false,
      mergeStatus: createdPR.mergeStatus?.toString() || "unknown",
      sourceBranch: createdPR.sourceRefName?.replace("refs/heads/", "") || "",
      targetBranch: createdPR.targetRefName?.replace("refs/heads/", "") || "",
      createdBy: createdPR.createdBy?.displayName || "Unknown",
      createdByEmail: createdPR.createdBy?.uniqueName || "",
      creationDate: createdPR.creationDate?.toISOString() || "",
      reviewers,
      url: `https://dev.azure.com/${organization}/${project}/_git/${repository}/pullrequest/${createdPR.pullRequestId}`,
    };

    return {
      success: true,
      message: `Created ${params.isDraft !== false ? "draft " : ""}PR #${createdPR.pullRequestId}: ${createdPR.title}`,
      data: prDetails,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to create PR: ${message}`,
      error: "CREATE_PR_FAILED",
    };
  }
}

// MCP Tool definition
export const CreatePRToolDefinition = {
  name: "create_pr",
  description:
    "Create a new pull request. By default creates a draft PR. Returns the created PR details including ID and URL.",
  inputSchema: {
    type: "object",
    properties: {
      sourceBranch: {
        type: "string",
        description:
          "Source branch name (e.g., 'feature/my-feature' or 'refs/heads/feature/my-feature')",
      },
      targetBranch: {
        type: "string",
        description:
          "Target branch name (e.g., 'main' or 'refs/heads/main')",
      },
      title: {
        type: "string",
        description: "Pull request title",
      },
      description: {
        type: "string",
        description: "Pull request description (supports markdown)",
      },
      isDraft: {
        type: "boolean",
        description: "Whether to create as a draft PR (default: true)",
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
    required: ["sourceBranch", "targetBranch", "title"],
  },
};

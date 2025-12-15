import { GitPullRequest, PullRequestStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi, requireOrg, requireProject, requireRepo } from "../connection.js";
import { getDefaults } from "../config.js";
import { OperationResult, PRListItem, ReviewerInfo, VoteLabels } from "../types.js";

export interface ListPRsParams {
  organization?: string;
  project?: string;
  repository?: string;
  status?: "active" | "completed" | "abandoned" | "all";
  creatorEmail?: string;
  reviewerEmail?: string;
  targetBranch?: string;
  top?: number;
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

function statusToEnum(status: string | undefined): PullRequestStatus {
  switch (status?.toLowerCase()) {
    case "active":
      return PullRequestStatus.Active;
    case "completed":
      return PullRequestStatus.Completed;
    case "abandoned":
      return PullRequestStatus.Abandoned;
    case "all":
      return PullRequestStatus.All;
    default:
      return PullRequestStatus.Active;
  }
}

function statusToString(status: PullRequestStatus | undefined): string {
  switch (status) {
    case PullRequestStatus.Active:
      return "active";
    case PullRequestStatus.Completed:
      return "completed";
    case PullRequestStatus.Abandoned:
      return "abandoned";
    case PullRequestStatus.All:
      return "all";
    default:
      return "unknown";
  }
}

export async function listPRs(params: ListPRsParams): Promise<OperationResult<PRListItem[]>> {
  try {
    const defaults = getDefaults();
    const org = requireOrg(params.organization, defaults.organization);
    const project = requireProject(params.project, defaults.project);
    const repo = requireRepo(params.repository, defaults.repository);

    const gitApi = await getGitApi(org);

    // Build search criteria
    const searchCriteria: any = {
      status: statusToEnum(params.status),
    };

    if (params.targetBranch) {
      searchCriteria.targetRefName = `refs/heads/${params.targetBranch}`;
    }

    const prs: GitPullRequest[] = await gitApi.getPullRequests(
      repo,
      searchCriteria,
      project,
      undefined, // maxCommentLength
      undefined, // skip
      params.top || 100 // top
    );

    // Filter by creator/reviewer if specified (API doesn't support these directly)
    let filteredPRs = prs;

    if (params.creatorEmail) {
      const creatorLower = params.creatorEmail.toLowerCase();
      filteredPRs = filteredPRs.filter(
        (pr) => pr.createdBy?.uniqueName?.toLowerCase() === creatorLower
      );
    }

    if (params.reviewerEmail) {
      const reviewerLower = params.reviewerEmail.toLowerCase();
      filteredPRs = filteredPRs.filter((pr) =>
        pr.reviewers?.some(
          (r) => r.uniqueName?.toLowerCase() === reviewerLower
        )
      );
    }

    const prList: PRListItem[] = filteredPRs.map((pr) => ({
      id: pr.pullRequestId || 0,
      title: pr.title || "",
      status: statusToString(pr.status),
      isDraft: pr.isDraft || false,
      sourceBranch: stripRefsHeads(pr.sourceRefName),
      targetBranch: stripRefsHeads(pr.targetRefName),
      createdBy: pr.createdBy?.displayName || "Unknown",
      createdByEmail: pr.createdBy?.uniqueName || "",
      reviewers: (pr.reviewers || []).map(formatReviewer),
      url: `https://dev.azure.com/${org}/${project}/_git/${repo}/pullrequest/${pr.pullRequestId}`,
    }));

    return {
      success: true,
      message: `Found ${prList.length} pull request(s)`,
      data: prList,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to list PRs: ${message}`,
      error: "LIST_PRS_FAILED",
    };
  }
}

// MCP Tool definition
export const ListPRsToolDefinition = {
  name: "list_prs",
  description:
    "List pull requests with optional filters. Shows status, draft flag, and all reviewers.",
  inputSchema: {
    type: "object",
    properties: {
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
      status: {
        type: "string",
        enum: ["active", "completed", "abandoned", "all"],
        description: "Filter by PR status (default: active)",
      },
      creatorEmail: {
        type: "string",
        description: "Filter by creator email",
      },
      reviewerEmail: {
        type: "string",
        description: "Filter by reviewer email",
      },
      targetBranch: {
        type: "string",
        description: "Filter by target branch (e.g., 'main')",
      },
      top: {
        type: "number",
        description: "Maximum number of PRs to return (default: 100)",
      },
    },
    required: [],
  },
};

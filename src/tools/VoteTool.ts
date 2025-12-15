import { IdentityRefWithVote } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult, VoteValues, VoteLabels } from "../types.js";

export interface VoteParams {
  pr: string;
  vote: "approve" | "approve-with-suggestions" | "wait-for-author" | "reject" | "reset";
  organization?: string;
  project?: string;
  repository?: string;
}

function voteStringToNumber(vote: string): number {
  switch (vote.toLowerCase()) {
    case "approve":
      return VoteValues.APPROVED;
    case "approve-with-suggestions":
      return VoteValues.APPROVED_WITH_SUGGESTIONS;
    case "wait-for-author":
      return VoteValues.WAITING_FOR_AUTHOR;
    case "reject":
      return VoteValues.REJECTED;
    case "reset":
    case "no-vote":
      return VoteValues.NO_VOTE;
    default:
      throw new Error(
        `Invalid vote: ${vote}. Use: approve, approve-with-suggestions, wait-for-author, reject, reset`
      );
  }
}

export async function vote(params: VoteParams): Promise<OperationResult<void>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const voteValue = voteStringToNumber(params.vote);
    const voteLabel = VoteLabels[voteValue] || params.vote;

    const gitApi = await getGitApi(id.organization);

    // Get current user's identity from the PR (we need their ID)
    // The API expects the reviewer ID, which we can get from the authenticated user
    // For now, we create a reviewer update with just the vote

    const reviewerUpdate: IdentityRefWithVote = {
      vote: voteValue,
    };

    // Use createPullRequestReviewer which creates or updates the reviewer
    // Passing "me" as the reviewer ID to vote as the authenticated user
    await gitApi.createPullRequestReviewer(
      reviewerUpdate,
      id.repository,
      id.pullRequestId,
      "me", // Special value to indicate the authenticated user
      id.project
    );

    return {
      success: true,
      message: `Voted "${voteLabel}" on PR #${id.pullRequestId}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to vote: ${message}`,
      error: "VOTE_FAILED",
    };
  }
}

// MCP Tool definition
export const VoteToolDefinition = {
  name: "vote",
  description:
    "Cast a vote on a pull request (approve, reject, wait for author, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      vote: {
        type: "string",
        enum: [
          "approve",
          "approve-with-suggestions",
          "wait-for-author",
          "reject",
          "reset",
        ],
        description: "Vote to cast",
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
    required: ["pr", "vote"],
  },
};

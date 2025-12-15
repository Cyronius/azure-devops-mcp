import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult } from "../types.js";

export interface DeleteCommentParams {
  pr: string;
  threadId: number;
  commentId: number;
  organization?: string;
  project?: string;
  repository?: string;
}

export async function deleteComment(
  params: DeleteCommentParams
): Promise<OperationResult<void>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    await gitApi.deleteComment(
      id.repository,
      id.pullRequestId,
      params.threadId,
      params.commentId,
      id.project
    );

    return {
      success: true,
      message: `Deleted comment ${params.commentId} from thread ${params.threadId}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to delete comment: ${message}`,
      error: "DELETE_COMMENT_FAILED",
    };
  }
}

// MCP Tool definition
export const DeleteCommentToolDefinition = {
  name: "delete_comment",
  description: "Delete a specific comment from a thread",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      threadId: {
        type: "number",
        description: "Thread ID containing the comment",
      },
      commentId: {
        type: "number",
        description: "Comment ID to delete",
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
    required: ["pr", "threadId", "commentId"],
  },
};

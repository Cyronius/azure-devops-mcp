import { CommentType } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult } from "../types.js";

export interface ReplyToThreadParams {
  pr: string;
  threadId: number;
  content: string;
  organization?: string;
  project?: string;
  repository?: string;
}

export interface ReplyResult {
  commentId: number;
}

export async function replyToThread(
  params: ReplyToThreadParams
): Promise<OperationResult<ReplyResult>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    const comment: any = {
      content: params.content,
      parentCommentId: 0, // Reply to the thread, not a specific comment
      commentType: CommentType.Text,
    };

    const result = await gitApi.createComment(
      comment,
      id.repository,
      id.pullRequestId,
      params.threadId,
      id.project
    );

    if (!result || !result.id) {
      return {
        success: false,
        message: "Failed to create reply - no ID returned",
        error: "CREATE_REPLY_FAILED",
      };
    }

    return {
      success: true,
      message: `Added reply to thread ${params.threadId}`,
      data: {
        commentId: result.id,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to reply to thread: ${message}`,
      error: "REPLY_TO_THREAD_FAILED",
    };
  }
}

// MCP Tool definition
export const ReplyToThreadToolDefinition = {
  name: "reply_to_thread",
  description: "Add a reply to an existing comment thread on a PR",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      threadId: {
        type: "number",
        description: "Thread ID to reply to",
      },
      content: {
        type: "string",
        description: "Reply text (supports markdown)",
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
    required: ["pr", "threadId", "content"],
  },
};

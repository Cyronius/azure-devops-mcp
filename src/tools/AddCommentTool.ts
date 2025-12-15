import { CommentThreadStatus, CommentType } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult } from "../types.js";

export interface AddCommentParams {
  pr: string;
  content: string;
  organization?: string;
  project?: string;
  repository?: string;
  // For inline comments
  filePath?: string;
  line?: number;
  lineEnd?: number;
}

export interface AddCommentResult {
  threadId: number;
  commentId: number;
}

export async function addComment(
  params: AddCommentParams
): Promise<OperationResult<AddCommentResult>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    // Build thread object
    const thread: any = {
      comments: [
        {
          parentCommentId: 0,
          content: params.content,
          commentType: CommentType.Text,
        },
      ],
      status: CommentThreadStatus.Active,
    };

    // Add thread context for inline comments
    if (params.filePath) {
      thread.threadContext = {
        filePath: params.filePath.startsWith("/")
          ? params.filePath
          : `/${params.filePath}`,
        rightFileStart: params.line
          ? { line: params.line, offset: 1 }
          : undefined,
        rightFileEnd: params.lineEnd
          ? { line: params.lineEnd, offset: 1 }
          : params.line
            ? { line: params.line, offset: 1 }
            : undefined,
      };
    }

    const result = await gitApi.createThread(
      thread,
      id.repository,
      id.pullRequestId,
      id.project
    );

    if (!result || !result.id) {
      return {
        success: false,
        message: "Failed to create comment thread - no ID returned",
        error: "CREATE_THREAD_FAILED",
      };
    }

    const commentId = result.comments?.[0]?.id || 0;

    return {
      success: true,
      message: params.filePath
        ? `Added inline comment on ${params.filePath}${params.line ? `:${params.line}` : ""}`
        : "Added general comment to PR",
      data: {
        threadId: result.id,
        commentId: commentId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to add comment: ${message}`,
      error: "ADD_COMMENT_FAILED",
    };
  }
}

// MCP Tool definition
export const AddCommentToolDefinition = {
  name: "add_comment",
  description:
    "Add a general comment or inline code comment to a pull request",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      content: {
        type: "string",
        description: "Comment text (supports markdown)",
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
      filePath: {
        type: "string",
        description: "File path for inline comment (e.g., /src/file.ts)",
      },
      line: {
        type: "number",
        description: "Starting line number for inline comment",
      },
      lineEnd: {
        type: "number",
        description: "Ending line number for multi-line selection",
      },
    },
    required: ["pr", "content"],
  },
};

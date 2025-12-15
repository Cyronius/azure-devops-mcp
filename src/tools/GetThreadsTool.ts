import { GitPullRequestCommentThread, CommentThreadStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult, ThreadInfo, CommentInfo, ThreadContext, ThreadStatusLabels } from "../types.js";

export interface GetThreadsParams {
  pr: string;
  organization?: string;
  project?: string;
  repository?: string;
  status?: "active" | "fixed" | "closed" | "all";
}

function statusToEnum(status: string | undefined): CommentThreadStatus | undefined {
  switch (status?.toLowerCase()) {
    case "active":
      return CommentThreadStatus.Active;
    case "fixed":
      return CommentThreadStatus.Fixed;
    case "closed":
      return CommentThreadStatus.Closed;
    case "all":
      return undefined; // No filter
    default:
      return undefined;
  }
}

function formatComment(comment: any): CommentInfo {
  return {
    id: comment.id || 0,
    parentCommentId: comment.parentCommentId || 0,
    content: comment.content || "",
    author: comment.author?.displayName || "Unknown",
    authorEmail: comment.author?.uniqueName || "",
    publishedDate: comment.publishedDate?.toISOString() || "",
    lastUpdatedDate: comment.lastUpdatedDate?.toISOString() || "",
    isDeleted: comment.isDeleted || false,
    commentType: comment.commentType !== undefined
      ? ["unknown", "text", "codeChange", "system"][comment.commentType] || "unknown"
      : "unknown",
  };
}

function formatThreadContext(ctx: any): ThreadContext | undefined {
  if (!ctx || !ctx.filePath) return undefined;

  return {
    filePath: ctx.filePath,
    rightFileStart: ctx.rightFileStart,
    rightFileEnd: ctx.rightFileEnd,
    leftFileStart: ctx.leftFileStart,
    leftFileEnd: ctx.leftFileEnd,
  };
}

export async function getThreads(params: GetThreadsParams): Promise<OperationResult<ThreadInfo[]>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);
    const threads: GitPullRequestCommentThread[] = await gitApi.getThreads(
      id.repository,
      id.pullRequestId,
      id.project
    );

    // Filter by status if specified
    const statusFilter = statusToEnum(params.status);
    let filteredThreads = threads;

    if (statusFilter !== undefined) {
      filteredThreads = threads.filter((t) => t.status === statusFilter);
    }

    const threadList: ThreadInfo[] = filteredThreads.map((thread) => ({
      id: thread.id || 0,
      status: ThreadStatusLabels[thread.status || 0] || "unknown",
      publishedDate: thread.publishedDate?.toISOString() || "",
      lastUpdatedDate: thread.lastUpdatedDate?.toISOString() || "",
      isDeleted: thread.isDeleted || false,
      comments: (thread.comments || []).map(formatComment),
      threadContext: formatThreadContext(thread.threadContext),
    }));

    return {
      success: true,
      message: `Found ${threadList.length} thread(s) on PR #${id.pullRequestId}`,
      data: threadList,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to get threads: ${message}`,
      error: "GET_THREADS_FAILED",
    };
  }
}

// MCP Tool definition
export const GetThreadsToolDefinition = {
  name: "get_threads",
  description: "Get all comment threads on a pull request",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
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
      status: {
        type: "string",
        enum: ["active", "fixed", "closed", "all"],
        description: "Filter by thread status (default: all)",
      },
    },
    required: ["pr"],
  },
};

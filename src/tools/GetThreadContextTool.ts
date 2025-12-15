import { GitPullRequestCommentThread } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult, ThreadStatusLabels } from "../types.js";

export interface GetThreadContextParams {
  pr: string;
  threadId: number;
  organization?: string;
  project?: string;
  repository?: string;
  linesContext?: number;
}

export interface ThreadContextResult {
  threadId: number;
  status: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  comments: Array<{
    id: number;
    author: string;
    content: string;
    publishedDate: string;
  }>;
}

export async function getThreadContext(
  params: GetThreadContextParams
): Promise<OperationResult<ThreadContextResult>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    // Get all threads and find the specific one
    const threads: GitPullRequestCommentThread[] = await gitApi.getThreads(
      id.repository,
      id.pullRequestId,
      id.project
    );

    const thread = threads.find((t) => t.id === params.threadId);

    if (!thread) {
      return {
        success: false,
        message: `Thread ${params.threadId} not found on PR #${id.pullRequestId}`,
        error: "THREAD_NOT_FOUND",
      };
    }

    const ctx = thread.threadContext;
    const result: ThreadContextResult = {
      threadId: thread.id || params.threadId,
      status: ThreadStatusLabels[thread.status || 0] || "unknown",
      filePath: ctx?.filePath || null,
      startLine: ctx?.rightFileStart?.line || ctx?.leftFileStart?.line || null,
      endLine: ctx?.rightFileEnd?.line || ctx?.leftFileEnd?.line || null,
      comments: (thread.comments || []).map((c) => ({
        id: c.id || 0,
        author: c.author?.displayName || "Unknown",
        content: c.content || "",
        publishedDate: c.publishedDate?.toISOString() || "",
      })),
    };

    return {
      success: true,
      message: result.filePath
        ? `Thread ${params.threadId} is on ${result.filePath}${result.startLine ? `:${result.startLine}` : ""}`
        : `Thread ${params.threadId} is a general comment (not attached to file)`,
      data: result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to get thread context: ${message}`,
      error: "GET_THREAD_CONTEXT_FAILED",
    };
  }
}

// MCP Tool definition
export const GetThreadContextToolDefinition = {
  name: "get_thread_context",
  description:
    "Get the file and line context for a specific comment thread on a PR",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      threadId: {
        type: "number",
        description: "Thread ID to get context for",
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
      linesContext: {
        type: "number",
        description: "Number of lines of context to include (default: 5)",
      },
    },
    required: ["pr", "threadId"],
  },
};

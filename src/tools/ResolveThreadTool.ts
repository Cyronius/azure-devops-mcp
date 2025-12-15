import { CommentThreadStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi } from "../connection.js";
import { getDefaults } from "../config.js";
import { parsePRInput } from "../url-parser.js";
import { OperationResult, ThreadStatusLabels } from "../types.js";

export interface ResolveThreadParams {
  pr: string;
  threadId: number;
  status?: "fixed" | "wontFix" | "closed" | "active";
  organization?: string;
  project?: string;
  repository?: string;
}

function statusToEnum(status: string | undefined): CommentThreadStatus {
  switch (status?.toLowerCase()) {
    case "fixed":
      return CommentThreadStatus.Fixed;
    case "wontfix":
      return CommentThreadStatus.WontFix;
    case "closed":
      return CommentThreadStatus.Closed;
    case "active":
      return CommentThreadStatus.Active;
    default:
      return CommentThreadStatus.Fixed;
  }
}

export async function resolveThread(
  params: ResolveThreadParams
): Promise<OperationResult<void>> {
  try {
    const defaults = getDefaults();
    const id = parsePRInput(params.pr, {
      organization: params.organization || defaults.organization,
      project: params.project || defaults.project,
      repository: params.repository || defaults.repository,
    });

    const gitApi = await getGitApi(id.organization);

    const newStatus = statusToEnum(params.status);

    const thread: any = {
      status: newStatus,
    };

    await gitApi.updateThread(
      thread,
      id.repository,
      id.pullRequestId,
      params.threadId,
      id.project
    );

    const statusLabel = ThreadStatusLabels[newStatus] || params.status || "fixed";

    return {
      success: true,
      message: `Thread ${params.threadId} marked as ${statusLabel}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to resolve thread: ${message}`,
      error: "RESOLVE_THREAD_FAILED",
    };
  }
}

// MCP Tool definition
export const ResolveThreadToolDefinition = {
  name: "resolve_thread",
  description: "Mark a comment thread as resolved (fixed, wontFix, or closed)",
  inputSchema: {
    type: "object",
    properties: {
      pr: {
        type: "string",
        description: "PR URL or ID",
      },
      threadId: {
        type: "number",
        description: "Thread ID to resolve",
      },
      status: {
        type: "string",
        enum: ["fixed", "wontFix", "closed", "active"],
        description: "Resolution status (default: fixed)",
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
    required: ["pr", "threadId"],
  },
};

#!/usr/bin/env node

/**
 * Azure DevOps MCP Server
 * Provides PR management tools via the Model Context Protocol
 */

import * as dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Load environment variables
dotenv.config();

// Import tools
import { createPR, CreatePRToolDefinition } from "./tools/CreatePRTool.js";
import { getPR, GetPRToolDefinition } from "./tools/GetPRTool.js";
import { listPRs, ListPRsToolDefinition } from "./tools/ListPRsTool.js";
import { getThreads, GetThreadsToolDefinition } from "./tools/GetThreadsTool.js";
import { getThreadContext, GetThreadContextToolDefinition } from "./tools/GetThreadContextTool.js";
import { addComment, AddCommentToolDefinition } from "./tools/AddCommentTool.js";
import { replyToThread, ReplyToThreadToolDefinition } from "./tools/ReplyToThreadTool.js";
import { resolveThread, ResolveThreadToolDefinition } from "./tools/ResolveThreadTool.js";
import { deleteComment, DeleteCommentToolDefinition } from "./tools/DeleteCommentTool.js";
import { addReviewer, AddReviewerToolDefinition } from "./tools/AddReviewerTool.js";
import { removeReviewer, RemoveReviewerToolDefinition } from "./tools/RemoveReviewerTool.js";
import { vote, VoteToolDefinition } from "./tools/VoteTool.js";
import { updatePR, UpdatePRToolDefinition } from "./tools/UpdatePRTool.js";
import { completePR, CompletePRToolDefinition } from "./tools/CompletePRTool.js";
import { abandonPR, AbandonPRToolDefinition } from "./tools/AbandonPRTool.js";
import { setAutoComplete, SetAutoCompleteToolDefinition } from "./tools/SetAutoCompleteTool.js";
import { reviewerStats, ReviewerStatsToolDefinition } from "./tools/ReviewerStatsTool.js";

// Tool definitions for MCP
const toolDefinitions = [
  CreatePRToolDefinition,
  GetPRToolDefinition,
  ListPRsToolDefinition,
  GetThreadsToolDefinition,
  GetThreadContextToolDefinition,
  AddCommentToolDefinition,
  ReplyToThreadToolDefinition,
  ResolveThreadToolDefinition,
  DeleteCommentToolDefinition,
  AddReviewerToolDefinition,
  RemoveReviewerToolDefinition,
  VoteToolDefinition,
  UpdatePRToolDefinition,
  CompletePRToolDefinition,
  AbandonPRToolDefinition,
  SetAutoCompleteToolDefinition,
  ReviewerStatsToolDefinition,
];

// Tool handlers mapping
const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  create_pr: createPR,
  get_pr: getPR,
  list_prs: listPRs,
  get_threads: getThreads,
  get_thread_context: getThreadContext,
  add_comment: addComment,
  reply_to_thread: replyToThread,
  resolve_thread: resolveThread,
  delete_comment: deleteComment,
  add_reviewer: addReviewer,
  remove_reviewer: removeReviewer,
  vote: vote,
  update_pr: updatePR,
  complete_pr: completePR,
  abandon_pr: abandonPR,
  set_auto_complete: setAutoComplete,
  reviewer_stats: reviewerStats,
};

// Initialize MCP server
const server = new Server(
  {
    name: "azure-devops-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = toolHandlers[name];
    if (!handler) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const result = await handler(args || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Azure DevOps MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

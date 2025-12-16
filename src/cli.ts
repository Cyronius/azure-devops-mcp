#!/usr/bin/env node

/**
 * Azure DevOps CLI
 * Command-line interface for PR management
 */

import * as dotenv from "dotenv";
import { program } from "commander";
import path from "path";
import { fileURLToPath } from "url";

// Get directory for .env loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from package root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Import tools
import { createPR } from "./tools/CreatePRTool.js";
import { getPR } from "./tools/GetPRTool.js";
import { listPRs } from "./tools/ListPRsTool.js";
import { getThreads } from "./tools/GetThreadsTool.js";
import { getThreadContext } from "./tools/GetThreadContextTool.js";
import { addComment } from "./tools/AddCommentTool.js";
import { replyToThread } from "./tools/ReplyToThreadTool.js";
import { resolveThread } from "./tools/ResolveThreadTool.js";
import { deleteComment } from "./tools/DeleteCommentTool.js";
import { addReviewer } from "./tools/AddReviewerTool.js";
import { removeReviewer } from "./tools/RemoveReviewerTool.js";
import { vote } from "./tools/VoteTool.js";
import { updatePR } from "./tools/UpdatePRTool.js";
import { completePR } from "./tools/CompletePRTool.js";
import { abandonPR } from "./tools/AbandonPRTool.js";
import { setAutoComplete } from "./tools/SetAutoCompleteTool.js";
import { reviewerStats } from "./tools/ReviewerStatsTool.js";

// Helper to output results
function output(result: any) {
  console.log(JSON.stringify(result, null, 2));
}

// Common options
function addCommonOptions(cmd: any) {
  return cmd
    .option("--org <organization>", "Azure DevOps organization")
    .option("--project <project>", "Project name")
    .option("--repo <repository>", "Repository name");
}

program
  .name("azdo")
  .description("Azure DevOps CLI for PR management")
  .version("1.0.0");

// create-pr
addCommonOptions(
  program
    .command("create-pr")
    .description("Create a new pull request (draft by default)")
    .requiredOption("--source <branch>", "Source branch name")
    .requiredOption("--target <branch>", "Target branch name")
    .requiredOption("--title <title>", "PR title")
    .option("--description <description>", "PR description (markdown)")
    .option("--no-draft", "Create as active PR instead of draft")
).action(async (options) => {
  const result = await createPR({
    sourceBranch: options.source,
    targetBranch: options.target,
    title: options.title,
    description: options.description,
    isDraft: options.draft,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// get-pr
addCommonOptions(
  program
    .command("get-pr <pr>")
    .description("Get details of a pull request")
).action(async (pr, options) => {
  const result = await getPR({
    pr,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// list-prs
addCommonOptions(
  program
    .command("list-prs")
    .description("List pull requests")
    .option("--status <status>", "Filter by status (active, completed, abandoned, all)", "active")
    .option("--creator <email>", "Filter by creator email")
    .option("--reviewer <email>", "Filter by reviewer email")
    .option("--target-branch <branch>", "Filter by target branch")
    .option("--top <number>", "Maximum number of PRs to return", "100")
).action(async (options) => {
  const result = await listPRs({
    organization: options.org,
    project: options.project,
    repository: options.repo,
    status: options.status,
    creatorEmail: options.creator,
    reviewerEmail: options.reviewer,
    targetBranch: options.targetBranch,
    top: parseInt(options.top, 10),
  });
  output(result);
});

// get-threads
addCommonOptions(
  program
    .command("get-threads <pr>")
    .description("Get comment threads on a PR")
    .option("--status <status>", "Filter by status (active, fixed, closed, all)")
).action(async (pr, options) => {
  const result = await getThreads({
    pr,
    organization: options.org,
    project: options.project,
    repository: options.repo,
    status: options.status,
  });
  output(result);
});

// get-thread-context
addCommonOptions(
  program
    .command("get-thread-context <pr> <threadId>")
    .description("Get file/line context for a comment thread")
    .option("--lines <number>", "Number of context lines", "5")
).action(async (pr, threadId, options) => {
  const result = await getThreadContext({
    pr,
    threadId: parseInt(threadId, 10),
    organization: options.org,
    project: options.project,
    repository: options.repo,
    linesContext: parseInt(options.lines, 10),
  });
  output(result);
});

// add-comment
addCommonOptions(
  program
    .command("add-comment <pr>")
    .description("Add a comment to a PR")
    .requiredOption("--content <text>", "Comment text")
    .option("--file <path>", "File path for inline comment")
    .option("--line <number>", "Starting line number")
    .option("--line-end <number>", "Ending line number")
).action(async (pr, options) => {
  const result = await addComment({
    pr,
    content: options.content,
    organization: options.org,
    project: options.project,
    repository: options.repo,
    filePath: options.file,
    line: options.line ? parseInt(options.line, 10) : undefined,
    lineEnd: options.lineEnd ? parseInt(options.lineEnd, 10) : undefined,
  });
  output(result);
});

// reply-to-thread
addCommonOptions(
  program
    .command("reply-to-thread <pr> <threadId>")
    .description("Reply to a comment thread")
    .requiredOption("--content <text>", "Reply text")
).action(async (pr, threadId, options) => {
  const result = await replyToThread({
    pr,
    threadId: parseInt(threadId, 10),
    content: options.content,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// resolve-thread
addCommonOptions(
  program
    .command("resolve-thread <pr> <threadId>")
    .description("Resolve a comment thread")
    .option("--status <status>", "Resolution status (fixed, wontFix, closed, active)", "fixed")
).action(async (pr, threadId, options) => {
  const result = await resolveThread({
    pr,
    threadId: parseInt(threadId, 10),
    status: options.status,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// delete-comment
addCommonOptions(
  program
    .command("delete-comment <pr> <threadId> <commentId>")
    .description("Delete a comment")
).action(async (pr, threadId, commentId, options) => {
  const result = await deleteComment({
    pr,
    threadId: parseInt(threadId, 10),
    commentId: parseInt(commentId, 10),
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// add-reviewer
addCommonOptions(
  program
    .command("add-reviewer <pr> <email>")
    .description("Add a reviewer to a PR")
    .option("--optional", "Add as optional reviewer (default: required)")
).action(async (pr, email, options) => {
  const result = await addReviewer({
    pr,
    email,
    isRequired: !options.optional,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// remove-reviewer
addCommonOptions(
  program
    .command("remove-reviewer <pr> <email>")
    .description("Remove a reviewer from a PR")
).action(async (pr, email, options) => {
  const result = await removeReviewer({
    pr,
    email,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// vote
addCommonOptions(
  program
    .command("vote <pr> <vote>")
    .description("Cast a vote on a PR (approve, approve-with-suggestions, wait-for-author, reject, reset)")
).action(async (pr, voteValue, options) => {
  const result = await vote({
    pr,
    vote: voteValue,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// update-pr
addCommonOptions(
  program
    .command("update-pr <pr>")
    .description("Update a PR's title and/or description")
    .option("--title <title>", "New title")
    .option("--description <description>", "New description")
).action(async (pr, options) => {
  const result = await updatePR({
    pr,
    title: options.title,
    description: options.description,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// complete-pr
addCommonOptions(
  program
    .command("complete-pr <pr>")
    .description("Complete (merge) a PR")
    .option("--no-delete-branch", "Keep source branch after merge")
    .option("--squash", "Squash merge")
    .option("--message <message>", "Merge commit message")
    .option("--bypass-policy", "Bypass branch policies (use with caution)")
).action(async (pr, options) => {
  const result = await completePR({
    pr,
    deleteSourceBranch: options.deleteBranch,
    squashMerge: options.squash,
    mergeCommitMessage: options.message,
    bypassPolicy: options.bypassPolicy,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// abandon-pr
addCommonOptions(
  program
    .command("abandon-pr <pr>")
    .description("Abandon a PR")
).action(async (pr, options) => {
  const result = await abandonPR({
    pr,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// set-auto-complete
addCommonOptions(
  program
    .command("set-auto-complete <pr>")
    .description("Set or cancel auto-complete on a PR")
    .option("--enable", "Enable auto-complete")
    .option("--disable", "Disable auto-complete")
    .option("--no-delete-branch", "Keep source branch when auto-completed")
    .option("--squash", "Squash merge when auto-completed")
).action(async (pr, options) => {
  if (!options.enable && !options.disable) {
    console.error("Error: Must specify --enable or --disable");
    process.exit(1);
  }
  const result = await setAutoComplete({
    pr,
    enable: options.enable || false,
    deleteSourceBranch: options.deleteBranch,
    squashMerge: options.squash,
    organization: options.org,
    project: options.project,
    repository: options.repo,
  });
  output(result);
});

// reviewer-stats
addCommonOptions(
  program
    .command("reviewer-stats")
    .description("Show reviewer assignment statistics across PRs (markdown table)")
    .option("--status <status>", "Filter by PR status (active, completed, abandoned, all)", "active")
    .option("--all", "Show all reviewers including optional (default: required only)")
    .option("--json", "Output raw JSON instead of markdown")
    .option("--discord-webhook <url>", "Post output to Discord webhook URL")
).action(async (options) => {
  const result = await reviewerStats({
    organization: options.org,
    project: options.project,
    repository: options.repo,
    status: options.status,
    requiredOnly: !options.all,
  });

  if (options.discordWebhook && result.success && result.data) {
    // Post to Discord
    const markdown = result.data.markdown;
    // Discord has a 2000 char limit, wrap in code block for formatting
    const content = "```\n" + markdown + "\n```";

    try {
      const response = await fetch(options.discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        console.error(`Discord webhook failed: ${response.status} ${response.statusText}`);
        process.exit(1);
      }
      console.log("Posted to Discord successfully");
    } catch (error) {
      console.error(`Discord webhook error: ${error}`);
      process.exit(1);
    }
  } else if (options.json) {
    output(result);
  } else if (result.success && result.data) {
    console.log(result.data.markdown);
  } else {
    output(result);
  }
});

// Parse and run
program.parse();

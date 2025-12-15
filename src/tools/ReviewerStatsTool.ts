import { GitPullRequest, PullRequestStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi, requireOrg, requireProject, requireRepo } from "../connection.js";
import { getDefaults } from "../config.js";
import { OperationResult, VoteLabels } from "../types.js";

export interface ReviewerStatsParams {
  organization?: string;
  project?: string;
  repository?: string;
  status?: "active" | "completed" | "abandoned" | "all";
  requiredOnly?: boolean;
}

export interface ReviewerStat {
  displayName: string;
  email: string;
  requiredCount: number;
  optionalCount: number;
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  waitingForAuthorCount: number;
  rejectedCount: number;
  prs: Array<{
    id: number;
    title: string;
    isRequired: boolean;
    vote: string;
  }>;
}

export interface ReviewerStatsResult {
  reviewers: ReviewerStat[];
  totalPRs: number;
  markdown: string;
}

interface Badge {
  emoji: string;
  title: string;
  description: string;
}

interface ReviewerBadge extends Badge {
  reviewer: ReviewerStat;
}

function assignBadges(stats: ReviewerStat[]): ReviewerBadge[] {
  const badges: ReviewerBadge[] = [];
  const avgRequired = stats.reduce((sum, r) => sum + r.requiredCount, 0) / stats.length || 0;

  for (const r of stats) {
    if (r.requiredCount === 0) continue;

    const completionRate = r.approvedCount / r.requiredCount;
    const unreviewedRate = r.pendingCount / r.requiredCount;
    const isHighVolume = r.requiredCount >= avgRequired * 1.5;
    const isLowVolume = r.requiredCount <= Math.max(1, avgRequired * 0.5);
    const isMedVolume = !isHighVolume && !isLowVolume;

    // Super Reviewer: High volume and all/most complete
    if (isHighVolume && completionRate >= 0.8) {
      badges.push({
        reviewer: r,
        emoji: "🦸",
        title: "Super Reviewer",
        description: `${r.displayName} is crushing it with ${r.approvedCount}/${r.requiredCount} reviews complete!`,
      });
    }
    // Overwhelmed: High volume with many unreviewed
    else if (isHighVolume && unreviewedRate >= 0.5) {
      badges.push({
        reviewer: r,
        emoji: "🆘",
        title: "Needs Backup",
        description: `${r.displayName} has ${r.pendingCount} unreviewed PRs - someone throw them a lifeline!`,
      });
    }
    // Slacking: Low/med volume with most unreviewed
    else if ((isLowVolume || isMedVolume) && unreviewedRate >= 0.7 && r.pendingCount >= 2) {
      badges.push({
        reviewer: r,
        emoji: "😴",
        title: "Needs Coffee",
        description: `${r.displayName} has ${r.pendingCount} PRs waiting... wakey wakey!`,
      });
    }
    // Underutilized: Very low volume
    else if (isLowVolume && r.requiredCount <= 1) {
      badges.push({
        reviewer: r,
        emoji: "🪑",
        title: "Benchwarmer",
        description: `${r.displayName} is barely in the game with only ${r.requiredCount} PR${r.requiredCount === 1 ? "" : "s"}. Put them in, coach!`,
      });
    }
    // Perfectionist: All reviews complete (non-trivial count)
    else if (r.requiredCount >= 2 && completionRate === 1) {
      badges.push({
        reviewer: r,
        emoji: "✨",
        title: "Flawless",
        description: `${r.displayName} has reviewed every single PR assigned. Respect.`,
      });
    }
    // Gatekeeper: Has rejections
    else if (r.rejectedCount >= 1) {
      badges.push({
        reviewer: r,
        emoji: "🚫",
        title: "Gatekeeper",
        description: `${r.displayName} isn't afraid to say no - ${r.rejectedCount} rejection${r.rejectedCount === 1 ? "" : "s"} and counting.`,
      });
    }
    // Waiting game: Lots of waiting-for-author
    else if (r.waitingForAuthorCount >= 2) {
      badges.push({
        reviewer: r,
        emoji: "⏳",
        title: "Waiting Room",
        description: `${r.displayName} is stuck waiting on authors for ${r.waitingForAuthorCount} PRs. Ball's in your court, devs!`,
      });
    }
    // Speed demon: Fast reviewer (high completion rate, medium volume)
    else if (isMedVolume && completionRate >= 0.7) {
      badges.push({
        reviewer: r,
        emoji: "⚡",
        title: "Speed Demon",
        description: `${r.displayName} is keeping the pipeline moving with ${r.approvedCount}/${r.requiredCount} done.`,
      });
    }
  }

  return badges;
}

function pickRandomBadge(badges: ReviewerBadge[]): ReviewerBadge | null {
  if (badges.length === 0) return null;
  return badges[Math.floor(Math.random() * badges.length)];
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

function generateMarkdownTable(stats: ReviewerStat[], totalPRs: number, requiredOnly: boolean): string {
  const lines: string[] = [];

  lines.push(`Reviewer Statistics (${totalPRs} Active PRs)\n`);

  // Filter stats if requiredOnly
  const filteredStats = requiredOnly ? stats.filter(r => r.requiredCount > 0) : stats;

  if (filteredStats.length === 0) {
    lines.push("No reviewers found.");
    return lines.join("\n");
  }

  // Calculate column widths
  const nameWidth = Math.max(8, ...filteredStats.map(r => r.displayName.length));

  if (requiredOnly) {
    const headers = ["Reviewer", "Required", "Approved", "Waiting for Author", "Rejected", "Unreviewed"];
    const widths = [nameWidth, 8, 8, 18, 8, 10];

    // Header row
    lines.push(headers.map((h, i) => h.padEnd(widths[i])).join("  "));
    lines.push(widths.map(w => "-".repeat(w)).join("  "));

    // Data rows
    for (const r of filteredStats) {
      lines.push([
        r.displayName.padEnd(widths[0]),
        String(r.requiredCount).padStart(widths[1]),
        String(r.approvedCount).padStart(widths[2]),
        String(r.waitingForAuthorCount).padStart(widths[3]),
        String(r.rejectedCount).padStart(widths[4]),
        String(r.pendingCount).padStart(widths[5]),
      ].join("  "));
    }
  } else {
    const headers = ["Reviewer", "Required", "Optional", "Total", "Approved", "Waiting for Author", "Rejected", "Unreviewed"];
    const widths = [nameWidth, 8, 8, 5, 8, 18, 8, 10];

    // Header row
    lines.push(headers.map((h, i) => h.padEnd(widths[i])).join("  "));
    lines.push(widths.map(w => "-".repeat(w)).join("  "));

    // Data rows
    for (const r of filteredStats) {
      lines.push([
        r.displayName.padEnd(widths[0]),
        String(r.requiredCount).padStart(widths[1]),
        String(r.optionalCount).padStart(widths[2]),
        String(r.totalCount).padStart(widths[3]),
        String(r.approvedCount).padStart(widths[4]),
        String(r.waitingForAuthorCount).padStart(widths[5]),
        String(r.rejectedCount).padStart(widths[6]),
        String(r.pendingCount).padStart(widths[7]),
      ].join("  "));
    }
  }

  // Add random badge/callout
  const badges = assignBadges(filteredStats);
  const badge = pickRandomBadge(badges);
  if (badge) {
    lines.push("");
    lines.push(`${badge.emoji} ${badge.title}: ${badge.description}`);
  }

  return lines.join("\n");
}

export async function reviewerStats(params: ReviewerStatsParams): Promise<OperationResult<ReviewerStatsResult>> {
  try {
    const defaults = getDefaults();
    const org = requireOrg(params.organization, defaults.organization);
    const project = params.project || defaults.project; // Optional now
    const repo = params.repository || defaults.repository; // Optional now

    const gitApi = await getGitApi(org);

    const searchCriteria: any = {
      status: statusToEnum(params.status),
    };

    let allPRs: GitPullRequest[] = [];

    if (project && repo) {
      // Specific project and repo
      allPRs = await gitApi.getPullRequests(repo, searchCriteria, project, undefined, undefined, 100);
    } else if (project) {
      // All repos in a specific project
      const repos = await gitApi.getRepositories(project);
      for (const r of repos) {
        if (!r.name) continue;
        try {
          const prs = await gitApi.getPullRequests(r.name, searchCriteria, project, undefined, undefined, 100);
          allPRs.push(...prs);
        } catch {
          // Skip repos we can't access
        }
      }
    } else {
      // All projects and repos in the org
      const repos = await gitApi.getRepositories();
      for (const r of repos) {
        if (!r.name || !r.project?.name) continue;
        try {
          const prs = await gitApi.getPullRequests(r.name, searchCriteria, r.project.name, undefined, undefined, 100);
          allPRs.push(...prs);
        } catch {
          // Skip repos we can't access
        }
      }
    }

    // Filter out draft PRs
    const nonDraftPRs = allPRs.filter(pr => !pr.isDraft);

    // Aggregate stats by reviewer
    const statsMap = new Map<string, ReviewerStat>();

    for (const pr of nonDraftPRs) {
      for (const reviewer of pr.reviewers || []) {
        // Only count required reviewers
        if (!reviewer.isRequired) continue;

        const email = reviewer.uniqueName?.toLowerCase() || "";
        if (!email) continue;

        if (!statsMap.has(email)) {
          statsMap.set(email, {
            displayName: reviewer.displayName || "Unknown",
            email: reviewer.uniqueName || "",
            requiredCount: 0,
            optionalCount: 0,
            totalCount: 0,
            approvedCount: 0,
            pendingCount: 0,
            waitingForAuthorCount: 0,
            rejectedCount: 0,
            prs: [],
          });
        }

        const stat = statsMap.get(email)!;
        stat.totalCount++;
        stat.requiredCount++;

        const vote = reviewer.vote || 0;
        if (vote >= 10) {
          stat.approvedCount++;
        } else if (vote === -5) {
          stat.waitingForAuthorCount++;
        } else if (vote <= -10) {
          stat.rejectedCount++;
        } else {
          stat.pendingCount++;
        }

        stat.prs.push({
          id: pr.pullRequestId || 0,
          title: pr.title || "",
          isRequired: true,
          vote: VoteLabels[vote] || "No vote",
        });
      }
    }

    // Sort by required count descending
    const sortedStats = Array.from(statsMap.values()).sort(
      (a, b) => b.requiredCount - a.requiredCount || b.totalCount - a.totalCount
    );

    const markdown = generateMarkdownTable(sortedStats, nonDraftPRs.length, params.requiredOnly !== false);

    return {
      success: true,
      message: `Generated stats for ${sortedStats.length} reviewers across ${nonDraftPRs.length} PRs (${allPRs.length - nonDraftPRs.length} drafts excluded)`,
      data: {
        reviewers: sortedStats,
        totalPRs: nonDraftPRs.length,
        markdown,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to get reviewer stats: ${message}`,
      error: "REVIEWER_STATS_FAILED",
    };
  }
}

// MCP Tool definition
export const ReviewerStatsToolDefinition = {
  name: "reviewer_stats",
  description:
    "Get statistics on reviewer assignments across pull requests, showing how many PRs each person is assigned to review",
  inputSchema: {
    type: "object",
    properties: {
      organization: {
        type: "string",
        description: "Azure DevOps organization (required)",
      },
      project: {
        type: "string",
        description: "Project name (optional - omit to query all projects in org)",
      },
      repository: {
        type: "string",
        description: "Repository name (optional - omit to query all repos in project/org)",
      },
      status: {
        type: "string",
        enum: ["active", "completed", "abandoned", "all"],
        description: "Filter by PR status (default: active)",
      },
      requiredOnly: {
        type: "boolean",
        description: "Only show required reviewer assignments (default: true)",
      },
    },
    required: [],
  },
};

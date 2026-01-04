import { GitPullRequest, PullRequestStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getGitApi, requireOrg } from "../connection.js";
import { getDefaults } from "../config.js";
import { OperationResult } from "../types.js";

export interface PRVelocityParams {
  organization?: string;
  yearsBack?: number;
}

export interface PRCompletionRecord {
  author: string;
  authorEmail: string;
  project: string;
  repository: string;
  closedDate: string;
  prId: number;
  title: string;
}

export interface PRVelocityResult {
  records: PRCompletionRecord[];
  csv: string;
  summary: {
    totalPRs: number;
    byAuthor: Record<string, number>;
    byProject: Record<string, number>;
    byMonth: Record<string, number>;
  };
}

export async function prVelocity(params: PRVelocityParams): Promise<OperationResult<PRVelocityResult>> {
  try {
    const defaults = getDefaults();
    const org = requireOrg(params.organization, defaults.organization);
    const yearsBack = params.yearsBack || 2;

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsBack);

    console.error(`Querying Azure DevOps organization: ${org}`);
    console.error(`Cutoff date: ${cutoffDate.toISOString().split('T')[0]}`);

    const gitApi = await getGitApi(org);

    // Get all repositories in the organization
    console.error("Fetching repositories...");
    const repos = await gitApi.getRepositories();
    console.error(`Found ${repos.length} repositories`);

    const allRecords: PRCompletionRecord[] = [];

    for (const repo of repos) {
      if (!repo.name || !repo.project?.name) continue;

      const projectName = repo.project.name;
      const repoName = repo.name;

      console.error(`Processing: ${projectName}/${repoName}`);

      let skip = 0;
      const top = 1000;
      let hasMore = true;

      while (hasMore) {
        try {
          const prs = await gitApi.getPullRequests(
            repo.id!,
            { status: PullRequestStatus.Completed },
            projectName,
            undefined,
            skip,
            top
          );

          if (!prs || prs.length === 0) {
            hasMore = false;
            continue;
          }

          for (const pr of prs) {
            if (!pr.closedDate) continue;

            const closedDate = new Date(pr.closedDate);
            if (closedDate >= cutoffDate) {
              allRecords.push({
                author: pr.createdBy?.displayName || "Unknown",
                authorEmail: pr.createdBy?.uniqueName || "",
                project: projectName,
                repository: repoName,
                closedDate: closedDate.toISOString().split('T')[0],
                prId: pr.pullRequestId || 0,
                title: pr.title || "",
              });
            }
          }

          console.error(`  Fetched ${prs.length} PRs (skip=${skip})`);

          if (prs.length < top) {
            hasMore = false;
          } else {
            skip += top;
          }
        } catch (error) {
          console.error(`  Error fetching PRs: ${error}`);
          hasMore = false;
        }
      }
    }

    // Sort by date
    allRecords.sort((a, b) => a.closedDate.localeCompare(b.closedDate));

    // Generate CSV
    const csvLines = ["Author,AuthorEmail,Project,Repository,ClosedDate,PRId,Title"];
    for (const r of allRecords) {
      // Escape title for CSV (handle commas and quotes)
      const escapedTitle = `"${r.title.replace(/"/g, '""')}"`;
      csvLines.push(`${r.author},${r.authorEmail},${r.project},${r.repository},${r.closedDate},${r.prId},${escapedTitle}`);
    }
    const csv = csvLines.join("\n");

    // Generate summary
    const byAuthor: Record<string, number> = {};
    const byProject: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    for (const r of allRecords) {
      byAuthor[r.author] = (byAuthor[r.author] || 0) + 1;
      byProject[r.project] = (byProject[r.project] || 0) + 1;
      const month = r.closedDate.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + 1;
    }

    return {
      success: true,
      message: `Found ${allRecords.length} completed PRs in the last ${yearsBack} year(s)`,
      data: {
        records: allRecords,
        csv,
        summary: {
          totalPRs: allRecords.length,
          byAuthor,
          byProject,
          byMonth,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to get PR velocity: ${message}`,
      error: "PR_VELOCITY_FAILED",
    };
  }
}

// MCP Tool definition
export const PRVelocityToolDefinition = {
  name: "pr_velocity",
  description:
    "Export completed PRs for the last N years with author, project, and date. Useful for velocity tracking and team metrics.",
  inputSchema: {
    type: "object",
    properties: {
      organization: {
        type: "string",
        description: "Azure DevOps organization (required)",
      },
      yearsBack: {
        type: "number",
        description: "Number of years to look back (default: 2)",
      },
    },
    required: [],
  },
};

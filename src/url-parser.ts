import { PRIdentifier } from "./types.js";
import { getDefaults } from "./config.js";

/**
 * Parse a PR URL or ID into its components.
 *
 * Accepts:
 * - Full URL: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
 * - PR ID only: "123" (requires defaults to be configured)
 */
export function parsePRInput(
  input: string,
  overrides?: {
    organization?: string;
    project?: string;
    repository?: string;
  }
): PRIdentifier {
  const defaults = getDefaults();

  // Merge overrides with defaults
  const org = overrides?.organization || defaults.organization;
  const project = overrides?.project || defaults.project;
  const repo = overrides?.repository || defaults.repository;

  // Try URL pattern first
  // Format: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
  const urlMatch = input.match(
    /dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/
  );

  if (urlMatch) {
    return {
      organization: urlMatch[1],
      project: urlMatch[2],
      repository: urlMatch[3],
      pullRequestId: parseInt(urlMatch[4], 10),
    };
  }

  // Try SSH URL pattern
  // Format: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
  const sshMatch = input.match(
    /ssh\.dev\.azure\.com:v3\/([^\/]+)\/([^\/]+)\/([^\/]+)/
  );

  if (sshMatch) {
    throw new Error(
      "SSH URLs don't contain PR IDs. Please provide the full PR URL or just the PR ID."
    );
  }

  // Fall back to PR ID only
  const idMatch = input.match(/^(\d+)$/);
  if (idMatch) {
    if (!org || !project || !repo) {
      throw new Error(
        "When using PR ID only, organization, project, and repository must be configured.\n" +
          "Set them in .env or provide --org, --project, --repo flags.\n" +
          `Current: org=${org || "missing"}, project=${project || "missing"}, repo=${repo || "missing"}`
      );
    }

    return {
      organization: org,
      project: project,
      repository: repo,
      pullRequestId: parseInt(idMatch[1], 10),
    };
  }

  throw new Error(
    `Invalid PR identifier: "${input}"\n` +
      "Expected formats:\n" +
      "  - Full URL: https://dev.azure.com/org/project/_git/repo/pullrequest/123\n" +
      "  - PR ID: 123 (requires --org, --project, --repo or .env defaults)"
  );
}

/**
 * Parse a git remote URL to extract org/project/repo
 */
export function parseRemoteUrl(remoteUrl: string): {
  organization: string;
  project: string;
  repository: string;
} | null {
  // HTTPS format: https://[user@]dev.azure.com/{org}/{project}/_git/{repo}
  const httpsMatch = remoteUrl.match(
    /dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/(.+?)(?:\.git)?$/
  );

  if (httpsMatch) {
    return {
      organization: httpsMatch[1],
      project: httpsMatch[2],
      repository: httpsMatch[3],
    };
  }

  // SSH format: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
  const sshMatch = remoteUrl.match(
    /ssh\.dev\.azure\.com:v3\/([^\/]+)\/([^\/]+)\/(.+?)(?:\.git)?$/
  );

  if (sshMatch) {
    return {
      organization: sshMatch[1],
      project: sshMatch[2],
      repository: sshMatch[3],
    };
  }

  return null;
}

/**
 * Build a PR URL from its components
 */
export function buildPRUrl(id: PRIdentifier): string {
  return `https://dev.azure.com/${id.organization}/${id.project}/_git/${id.repository}/pullrequest/${id.pullRequestId}`;
}

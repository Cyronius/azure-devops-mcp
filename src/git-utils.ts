/**
 * Git utility functions with no external dependencies
 */

/**
 * Parse a git remote URL to extract Azure DevOps org/project/repo
 */
export function parseAzureDevOpsRemoteUrl(remoteUrl: string): {
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

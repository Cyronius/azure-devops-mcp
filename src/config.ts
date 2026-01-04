import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { parseAzureDevOpsRemoteUrl } from "./git-utils.js";

// Get directory for relative imports in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the package root directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export interface AzureDevOpsConfig {
  pat: string;
  defaultOrg?: string;
  defaultProject?: string;
  defaultRepo?: string;
}

let config: AzureDevOpsConfig | null = null;

// Cache for git remote detection
let gitRemoteDefaults: {
  organization?: string;
  project?: string;
  repository?: string;
} | null = null;
let gitRemoteChecked = false;

/**
 * Detect Azure DevOps org/project/repo from current directory's git remote
 */
function detectFromGitRemote(): {
  organization?: string;
  project?: string;
  repository?: string;
} {
  if (gitRemoteChecked) {
    return gitRemoteDefaults || {};
  }
  gitRemoteChecked = true;

  try {
    // Check if we're in a git repo
    execSync("git rev-parse --git-dir", { stdio: "pipe" });

    // Get remote URL
    const remoteUrl = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const parsed = parseAzureDevOpsRemoteUrl(remoteUrl);
    if (parsed) {
      gitRemoteDefaults = parsed;
      return parsed;
    }
  } catch {
    // Not in a git repo or no origin remote - that's fine
  }

  return {};
}

export function getConfig(): AzureDevOpsConfig {
  if (config) return config;

  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!pat) {
    throw new Error(
      "AZURE_DEVOPS_PAT environment variable is required.\n" +
        "Create a PAT at: https://dev.azure.com/{org}/_usersSettings/tokens\n" +
        "Required scopes: Code (Read & Write), Pull Request Threads (Read & Write)"
    );
  }

  config = {
    pat,
    defaultOrg: process.env.AZURE_DEVOPS_ORG,
    defaultProject: process.env.AZURE_DEVOPS_PROJECT,
    defaultRepo: process.env.AZURE_DEVOPS_REPO,
  };

  return config;
}

/**
 * Get defaults for org/project/repo.
 * Priority: CLI flags > git remote > .env file
 */
export function getDefaults(): {
  organization?: string;
  project?: string;
  repository?: string;
} {
  const cfg = getConfig();
  const gitDefaults = detectFromGitRemote();

  // Git remote takes priority over .env defaults
  // (CLI flags handled separately in parsePRInput)
  return {
    organization: gitDefaults.organization || cfg.defaultOrg,
    project: gitDefaults.project || cfg.defaultProject,
    repository: gitDefaults.repository || cfg.defaultRepo,
  };
}

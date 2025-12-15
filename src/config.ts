import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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

export function getDefaults(): {
  organization?: string;
  project?: string;
  repository?: string;
} {
  const cfg = getConfig();
  return {
    organization: cfg.defaultOrg,
    project: cfg.defaultProject,
    repository: cfg.defaultRepo,
  };
}

import * as azdev from "azure-devops-node-api";
import { IGitApi } from "azure-devops-node-api/GitApi.js";
import { getConfig } from "./config.js";

let webApi: azdev.WebApi | null = null;
let gitApi: IGitApi | null = null;

// Track current org to handle switching between orgs
let currentOrg: string | null = null;

export async function getConnection(organization: string): Promise<azdev.WebApi> {
  const config = getConfig();

  // If org changed, reset connections
  if (currentOrg !== organization) {
    webApi = null;
    gitApi = null;
    currentOrg = organization;
  }

  if (webApi) return webApi;

  const orgUrl = `https://dev.azure.com/${organization}`;
  const authHandler = azdev.getPersonalAccessTokenHandler(config.pat);
  webApi = new azdev.WebApi(orgUrl, authHandler);

  return webApi;
}

export async function getGitApi(organization: string): Promise<IGitApi> {
  // If org changed, reset gitApi
  if (currentOrg !== organization) {
    gitApi = null;
  }

  if (gitApi) return gitApi;

  const connection = await getConnection(organization);
  gitApi = await connection.getGitApi();

  return gitApi;
}

// Helper to ensure we have a valid org
export function requireOrg(org: string | undefined, defaultOrg: string | undefined): string {
  const organization = org || defaultOrg;
  if (!organization) {
    throw new Error(
      "Organization is required. Provide --org or set AZURE_DEVOPS_ORG in .env"
    );
  }
  return organization;
}

export function requireProject(project: string | undefined, defaultProject: string | undefined): string {
  const proj = project || defaultProject;
  if (!proj) {
    throw new Error(
      "Project is required. Provide --project or set AZURE_DEVOPS_PROJECT in .env"
    );
  }
  return proj;
}

export function requireRepo(repo: string | undefined, defaultRepo: string | undefined): string {
  const repository = repo || defaultRepo;
  if (!repository) {
    throw new Error(
      "Repository is required. Provide --repo or set AZURE_DEVOPS_REPO in .env"
    );
  }
  return repository;
}

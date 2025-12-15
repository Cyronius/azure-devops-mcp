# Azure DevOps MCP Server & CLI

A TypeScript-based tool for managing Azure DevOps Pull Requests via CLI or MCP (Model Context Protocol) server.

## Features

- **Full PR Management**: Get, list, update, complete, abandon PRs
- **Code Review**: Add/remove reviewers, cast votes, manage comments
- **Thread Management**: Create threads, reply, resolve, get file context
- **Auto-complete**: Set or cancel auto-complete with merge options
- **Reviewer Stats**: Aggregate reviewer assignment statistics with fun badges
- **Dual Interface**: Use as CLI tool or MCP server for AI assistants

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/azure-devops-mcp.git
cd azure-devops-mcp

# Install dependencies
npm install

# Build
npm run build

# Install globally (optional)
npm run install-global
```

## Configuration

Create a `.env` file in the project root:

```env
# Required
AZURE_DEVOPS_PAT=your-personal-access-token

# Optional defaults (can be overridden via CLI flags)
AZURE_DEVOPS_ORG=your-organization
AZURE_DEVOPS_PROJECT=your-project
AZURE_DEVOPS_REPO=your-repository
```

## CLI Usage

```bash
# List active PRs
azdo list-prs --org myorg --project myproject --repo myrepo

# Get PR details (by ID or URL)
azdo get-pr 123
azdo get-pr "https://dev.azure.com/org/project/_git/repo/pullrequest/123"

# Get comment threads
azdo get-threads 123 --status active

# Get file context for a thread
azdo get-thread-context 123 456 --lines 10

# Add a comment
azdo add-comment 123 --content "Looks good!"
azdo add-comment 123 --content "Consider refactoring" --file src/index.ts --line 42

# Reply to a thread
azdo reply-to-thread 123 456 --content "Fixed in latest commit"

# Resolve a thread
azdo resolve-thread 123 456 --status fixed

# Add/remove reviewers
azdo add-reviewer 123 user@example.com
azdo add-reviewer 123 user@example.com --optional
azdo remove-reviewer 123 user@example.com

# Vote on a PR
azdo vote 123 approve
azdo vote 123 approve-with-suggestions
azdo vote 123 wait-for-author
azdo vote 123 reject
azdo vote 123 reset

# Update PR title/description
azdo update-pr 123 --title "New title" --description "Updated description"

# Complete (merge) a PR
azdo complete-pr 123 --squash --delete-branch

# Abandon a PR
azdo abandon-pr 123

# Set auto-complete
azdo set-auto-complete 123 --enable --squash --delete-branch
azdo set-auto-complete 123 --disable

# Reviewer statistics
azdo reviewer-stats --org myorg
azdo reviewer-stats --org myorg --project myproject --json
azdo reviewer-stats --org myorg --discord-webhook "https://discord.com/api/webhooks/..."
```

## MCP Server Usage

Add to your MCP configuration (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["/path/to/azure-devops-mcp/dist/index.js"],
      "env": {
        "AZURE_DEVOPS_PAT": "your-pat-token",
        "AZURE_DEVOPS_ORG": "your-org",
        "AZURE_DEVOPS_PROJECT": "your-project",
        "AZURE_DEVOPS_REPO": "your-repo"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_pr` | Get details of a pull request |
| `list_prs` | List pull requests with filters |
| `get_threads` | Get comment threads on a PR |
| `get_thread_context` | Get file/line context for a thread |
| `add_comment` | Add a comment (general or inline) |
| `reply_to_thread` | Reply to a comment thread |
| `resolve_thread` | Resolve a comment thread |
| `delete_comment` | Delete a comment |
| `add_reviewer` | Add a reviewer to a PR |
| `remove_reviewer` | Remove a reviewer from a PR |
| `vote` | Cast a vote on a PR |
| `update_pr` | Update PR title/description |
| `complete_pr` | Complete (merge) a PR |
| `abandon_pr` | Abandon a PR |
| `set_auto_complete` | Set or cancel auto-complete |
| `reviewer_stats` | Get reviewer assignment statistics |

## Reviewer Stats

The `reviewer-stats` command aggregates reviewer assignments across all active PRs and includes fun badges:

```
Reviewer Statistics (12 Active PRs)

Reviewer          Required  Approved  Waiting for Author  Rejected  Unreviewed
----------------  --------  --------  ------------------  --------  ----------
Josh Bonnell             5         3                   1         0           1
Victoria Day             4         4                   0         0           0
Nick Fritsche            3         1                   0         0           2

✨ Flawless: Victoria Day has reviewed every single PR assigned. Respect.
```

### Badges

| Badge | Condition |
|-------|-----------|
| 🦸 Super Reviewer | High volume + 80%+ completion |
| 🆘 Needs Backup | High volume + 50%+ unreviewed |
| 😴 Needs Coffee | Low/med volume + 70%+ unreviewed |
| 🪑 Benchwarmer | Only 1 PR assigned |
| ✨ Flawless | All PRs reviewed (2+ assigned) |
| 🚫 Gatekeeper | Has rejections |
| ⏳ Waiting Room | 2+ blocked PRs |
| ⚡ Speed Demon | Medium volume + 70%+ completion |

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Run MCP server
npm start

# Run CLI
node dist/cli.js --help
```

## License

MIT

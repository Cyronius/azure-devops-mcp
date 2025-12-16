<#
.SYNOPSIS
    Posts Azure DevOps PR reviewer statistics to Discord.

.DESCRIPTION
    Queries Azure DevOps for all active, non-draft PRs across an organization,
    aggregates reviewer statistics (only counting required reviewers), and posts
    a formatted ASCII table to a Discord webhook.

.PARAMETER Organization
    Azure DevOps organization name (required)

.PARAMETER Pat
    Azure DevOps Personal Access Token. Can also be set via AZURE_DEVOPS_PAT environment variable.

.PARAMETER DiscordWebhook
    Discord webhook URL. Can also be set via DISCORD_WEBHOOK environment variable.

.PARAMETER Project
    Optional: Filter to a specific project

.PARAMETER Repository
    Optional: Filter to a specific repository (requires Project)

.PARAMETER AzureRunbookWebhook
    Optional: Azure Runbook webhook URL to trigger a refresh. Can also be set via AZURE_RUNBOOK_WEBHOOK environment variable.
    If provided, adds a refresh link to the Discord message.

.EXAMPLE
    .\reviewer-stats-discord.ps1 -Organization "myorg" -Pat "xxxx" -DiscordWebhook "https://discord.com/api/webhooks/..."

.EXAMPLE
    # Using environment variables
    $env:AZURE_DEVOPS_PAT = "xxxx"
    $env:DISCORD_WEBHOOK = "https://discord.com/api/webhooks/..."
    .\reviewer-stats-discord.ps1 -Organization "myorg"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Organization,

    [Parameter(Mandatory = $false)]
    [string]$Pat = $env:AZURE_DEVOPS_PAT,

    [Parameter(Mandatory = $false)]
    [string]$DiscordWebhook = $env:DISCORD_WEBHOOK,

    [Parameter(Mandatory = $false)]
    [string]$Project,

    [Parameter(Mandatory = $false)]
    [string]$Repository,

    [Parameter(Mandatory = $false)]
    [string]$AzureRunbookWebhook = $env:AZURE_RUNBOOK_WEBHOOK
)

# Validate required parameters
if (-not $Pat) {
    throw "Azure DevOps PAT is required. Provide -Pat or set AZURE_DEVOPS_PAT environment variable."
}
if (-not $DiscordWebhook) {
    throw "Discord webhook URL is required. Provide -DiscordWebhook or set DISCORD_WEBHOOK environment variable."
}

# Setup authentication
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$Pat"))
$headers = @{
    Authorization = "Basic $base64Auth"
    "Content-Type" = "application/json"
}

$baseUrl = "https://dev.azure.com/$Organization"

# Badge definitions (using Discord emoji shortcodes)
$badges = @(
    @{ Emoji = ":superhero:"; Title = "Super Reviewer"; Condition = { param($r, $avg) $r.Required -ge ($avg * 1.5) -and $r.Required -gt 0 -and ($r.Approved / $r.Required) -ge 0.8 }; Message = { param($r) "$($r.Name) is crushing it with $($r.Approved)/$($r.Required) reviews complete!" } }
    @{ Emoji = ":sos:"; Title = "Needs Backup"; Condition = { param($r, $avg) $r.Required -ge ($avg * 1.5) -and $r.Required -gt 0 -and ($r.Unreviewed / $r.Required) -ge 0.5 }; Message = { param($r) "$($r.Name) has $($r.Unreviewed) unreviewed PRs - someone throw them a lifeline!" } }
    @{ Emoji = ":sleeping:"; Title = "Needs Coffee"; Condition = { param($r, $avg) $r.Required -le ($avg * 0.5) -and $r.Required -gt 0 -and $r.Unreviewed -ge 2 -and ($r.Unreviewed / $r.Required) -ge 0.7 }; Message = { param($r) "$($r.Name) has $($r.Unreviewed) PRs waiting... wakey wakey!" } }
    @{ Emoji = ":chair:"; Title = "Benchwarmer"; Condition = { param($r, $avg) $r.Required -le 1 -and $r.Required -gt 0 }; Message = { param($r) "$($r.Name) is barely in the game with only $($r.Required) PR$(if($r.Required -ne 1){'s'}). Put them in, coach!" } }
    @{ Emoji = ":sparkles:"; Title = "Flawless"; Condition = { param($r, $avg) $r.Required -ge 2 -and $r.Approved -eq $r.Required }; Message = { param($r) "$($r.Name) has reviewed every single PR assigned. Respect." } }
    @{ Emoji = ":no_entry_sign:"; Title = "Gatekeeper"; Condition = { param($r, $avg) $r.Blocked -ge 1 }; Message = { param($r) "$($r.Name) isn't afraid to say no - $($r.Blocked) rejection$(if($r.Blocked -ne 1){'s'}) and counting." } }
    @{ Emoji = ":hourglass:"; Title = "Waiting Room"; Condition = { param($r, $avg) $r.Blocked -ge 2 }; Message = { param($r) "$($r.Name) is stuck waiting on $($r.Blocked) PRs. Ball's in your court, devs!" } }
    @{ Emoji = ":zap:"; Title = "Speed Demon"; Condition = { param($r, $avg) $r.Required -gt ($avg * 0.5) -and $r.Required -lt ($avg * 1.5) -and $r.Required -gt 0 -and ($r.Approved / $r.Required) -ge 0.7 }; Message = { param($r) "$($r.Name) is keeping the pipeline moving with $($r.Approved)/$($r.Required) done." } }
)

function Get-Repositories {
    param([string]$ProjectName)

    if ($ProjectName) {
        $url = "$baseUrl/$ProjectName/_apis/git/repositories?api-version=7.0"
    } else {
        $url = "$baseUrl/_apis/git/repositories?api-version=7.0"
    }

    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        return $response.value
    } catch {
        Write-Warning "Failed to get repositories: $_"
        return @()
    }
}

function Get-PullRequests {
    param(
        [string]$ProjectName,
        [string]$RepoId
    )

    $url = "$baseUrl/$ProjectName/_apis/git/repositories/$RepoId/pullrequests?searchCriteria.status=active&api-version=7.0"

    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        return $response.value
    } catch {
        Write-Warning "Failed to get PRs for repo $RepoId : $_"
        return @()
    }
}

# Collect all PRs
Write-Host "Fetching repositories..."
$allPRs = @()

if ($Project -and $Repository) {
    # Specific repo
    $repos = Get-Repositories -ProjectName $Project | Where-Object { $_.name -eq $Repository }
} elseif ($Project) {
    # All repos in project
    $repos = Get-Repositories -ProjectName $Project
} else {
    # All repos in org
    $repos = Get-Repositories
}

Write-Host "Found $($repos.Count) repositories"

foreach ($repo in $repos) {
    $projectName = $repo.project.name
    $prs = Get-PullRequests -ProjectName $projectName -RepoId $repo.id
    $allPRs += $prs
}

Write-Host "Found $($allPRs.Count) total PRs"

# Filter out drafts
$activePRs = $allPRs | Where-Object { -not $_.isDraft }
Write-Host "Found $($activePRs.Count) non-draft PRs"

# Aggregate stats by reviewer (only required reviewers)
$reviewerStats = @{}

foreach ($pr in $activePRs) {
    foreach ($reviewer in $pr.reviewers) {
        # Only count required reviewers
        if (-not $reviewer.isRequired) { continue }

        $email = $reviewer.uniqueName.ToLower()
        if (-not $email) { continue }

        if (-not $reviewerStats.ContainsKey($email)) {
            # Extract first name only
            $fullName = $reviewer.displayName
            $firstName = ($fullName -split ' ')[0]

            $reviewerStats[$email] = @{
                Name = $firstName
                Email = $email
                Required = 0
                Approved = 0
                Blocked = 0      # Waiting for Author + Rejected combined
                Unreviewed = 0
            }
        }

        $stat = $reviewerStats[$email]
        $stat.Required++

        $vote = $reviewer.vote
        if ($vote -ge 5) {
            # Approved (10) or Approved with Suggestions (5)
            $stat.Approved++
        } elseif ($vote -eq -5 -or $vote -le -10) {
            # Waiting for Author (-5) or Rejected (-10) = Blocked
            $stat.Blocked++
        } else {
            # No response (0) or other
            $stat.Unreviewed++
        }
    }
}

# Convert to array and sort by required count descending
$sortedStats = @($reviewerStats.Values | Sort-Object -Property Required -Descending)

if ($sortedStats.Count -eq 0) {
    Write-Host "No reviewer stats to report"
    exit 0
}

# Calculate average for badge logic
$avgRequired = 0
if ($sortedStats.Count -gt 0) {
    $avgRequired = ($sortedStats | ForEach-Object { $_.Required } | Measure-Object -Average).Average
}

# Find applicable badges
$applicableBadges = @()
foreach ($stat in $sortedStats) {
    foreach ($badge in $badges) {
        if (& $badge.Condition $stat $avgRequired) {
            $applicableBadges += @{
                Badge = $badge
                Stat = $stat
            }
        }
    }
}

# Pick random badge
$selectedBadge = $null
if ($applicableBadges.Count -gt 0) {
    $selectedBadge = $applicableBadges | Get-Random
}

# Generate ASCII table (compact for mobile)
$nameWidth = [Math]::Max(6, ($sortedStats | ForEach-Object { $_.Name.Length } | Measure-Object -Maximum).Maximum)

$headers = @("Name", "Assigned", "Done", "Blocked", "Todo")
$widths = @($nameWidth, 8, 4, 7, 4)

$lines = @()
$lines += "PR Review Stats ($($activePRs.Count) Active)"
$lines += ""

# Header row
$headerLine = ""
for ($i = 0; $i -lt $headers.Count; $i++) {
    $headerLine += $headers[$i].PadRight($widths[$i]) + " "
}
$lines += $headerLine.TrimEnd()

# Separator
$sepLine = ""
for ($i = 0; $i -lt $widths.Count; $i++) {
    $sepLine += ("-" * $widths[$i]) + " "
}
$lines += $sepLine.TrimEnd()

# Data rows
foreach ($stat in $sortedStats) {
    $row = $stat.Name.PadRight($widths[0]) + " "
    $row += $stat.Required.ToString().PadLeft($widths[1]) + " "
    $row += $stat.Approved.ToString().PadLeft($widths[2]) + " "
    $row += $stat.Blocked.ToString().PadLeft($widths[3]) + " "
    $row += $stat.Unreviewed.ToString().PadLeft($widths[4])
    $lines += $row
}

# Build badge line separately (outside code block for emoji rendering)
$badgeLine = ""
if ($selectedBadge) {
    $badgeMessage = & $selectedBadge.Badge.Message $selectedBadge.Stat
    $badgeLine = "`n$($selectedBadge.Badge.Emoji) **$($selectedBadge.Badge.Title):** $badgeMessage"
}

$tableOutput = $lines -join "`n"

Write-Host ""
Write-Host $tableOutput
if ($badgeLine) {
    Write-Host $badgeLine
}
Write-Host ""

# Build refresh link if Azure Runbook webhook is provided
$refreshLink = ""
if ($AzureRunbookWebhook) {
    $refreshLink = "   [:arrows_counterclockwise:  Refresh]($AzureRunbookWebhook)"
}

# Post to Discord - table in code block, badge outside for emoji rendering
$discordContent = "``````" + "`n" + $tableOutput + "`n" + "``````" + $badgeLine + $refreshLink

$discordBody = @{
    content = $discordContent
} | ConvertTo-Json -Compress

try {
    $response = Invoke-RestMethod -Uri $DiscordWebhook -Method Post -Body $discordBody -ContentType "application/json"
    Write-Host "Posted to Discord successfully"
} catch {
    Write-Error "Failed to post to Discord: $_"
    exit 1
}

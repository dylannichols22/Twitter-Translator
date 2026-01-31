param(
  [Parameter(Mandatory = $true)]
  [string]$DocFile,

  [int]$MaxIterations = 8,

  [string]$CompletionToken = "DONE",

  [string]$LogDir = "artifacts/ralph-loop"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $DocFile)) {
  throw "Doc file not found: $DocFile"
}

$docPath = (Resolve-Path -LiteralPath $DocFile).Path

if (-not (Test-Path -LiteralPath $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function New-Prompt([string]$docPath, [string]$completionToken) {
@"
You are Codex running in the repo. Implement the spec in: $docPath.
Follow the repo's AGENTS.md instructions, including TDD workflow.
Work in small increments. After each run, state what you changed and what remains.
When the implementation is complete, output the exact token on its own line: $completionToken
"@
}

for ($i = 1; $i -le $MaxIterations; $i++) {
  $iter = $i.ToString("000")
  $promptFile = Join-Path $LogDir "iter-$iter.prompt.txt"
  $responseFile = Join-Path $LogDir "iter-$iter.response.txt"
  $prompt = New-Prompt -docPath $docPath -completionToken $CompletionToken

  Write-Host "[ralph-loop] Iteration $i/$MaxIterations"
  $prompt | Set-Content -Path $promptFile

  Write-Host "[ralph-loop] Prompt saved to: $promptFile"
  Write-Host "[ralph-loop] Add your response to: $responseFile"
  Write-Host "[ralph-loop] Type '$CompletionToken' to stop, or press Enter to continue when ready."

  $input = Read-Host "Response"
  if ($input -eq $CompletionToken) {
    Write-Host "[ralph-loop] Completion token detected. Exiting."
    exit 0
  }

  if (Test-Path -LiteralPath $responseFile) {
    $response = Get-Content -Path $responseFile -Raw
    if ($response -match "(?m)^$([regex]::Escape($CompletionToken))$") {
      Write-Host "[ralph-loop] Completion token detected in response file. Exiting."
      exit 0
    }
  }
}

Write-Host "[ralph-loop] Max iterations reached without completion token."
exit 1

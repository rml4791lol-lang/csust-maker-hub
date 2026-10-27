# 项目内 imagegen 调用封装：解密 DPAPI 凭据 -> 调 gpt-image-2 CLI
# 用法:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\imagegen.ps1 `
#     -PromptFile public\assets\.prompt-hero.txt -Out public\assets\hero.png -Force

[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)][string]$PromptFile,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Size = "2048x1152",
  [string]$Quality = "medium",
  [string]$Model = "gpt-image-2",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$SecretPath = "C:\Users\morgan\.codex\secrets\squareface-image-api-key.dpapi"
$Cli = "C:\Users\morgan\.codex\skills\.system\imagegen\scripts\image_gen.py"
$BaseUrl = "https://api.squarefaceicon.org/v1"

if (!(Test-Path -LiteralPath $Cli)) { throw "Missing imagegen CLI: $Cli" }
if (!(Test-Path -LiteralPath $SecretPath)) { throw "Missing DPAPI credential: $SecretPath" }
if (!(Test-Path -LiteralPath $PromptFile)) { throw "Missing prompt file: $PromptFile" }

$cipherText = (Get-Content -Raw -Encoding Ascii -LiteralPath $SecretPath).Trim()
$secureKey = ConvertTo-SecureString $cipherText
$keyPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPtr)
} finally {
  if ($keyPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPtr) | Out-Null
  }
}
$env:OPENAI_BASE_URL = $BaseUrl
$env:NO_PROXY = "api.squarefaceicon.org,.api.squarefaceicon.org"

$pythonArgs = @(
  "generate",
  "--prompt-file", (Resolve-Path -LiteralPath $PromptFile).Path,
  "--size", $Size,
  "--quality", $Quality,
  "--model", $Model,
  "--out", $Out
)
if ($Force) { $pythonArgs += "--force" }

& python $Cli @pythonArgs 2>&1
exit $LASTEXITCODE

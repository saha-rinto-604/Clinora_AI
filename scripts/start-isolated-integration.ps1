param()
$ErrorActionPreference = 'Stop'
$integrationRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $integrationRoot

function Invoke-Checked([string] $Command, [string[]] $Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}

function New-LocalSecret {
    $bytes = New-Object byte[] 36
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

Invoke-Checked 'docker' @('info', '--format', '{{.ServerVersion}}')
$integrationEnv = Join-Path $integrationRoot '.env.integration'
if (-not (Test-Path -LiteralPath $integrationEnv)) {
    # These credentials are generated only for this disposable local Compose project.
    $settings = [ordered]@{
        POSTGRES_DB = 'clinora_integration_clean'
        POSTGRES_USER = 'clinora'
        POSTGRES_PASSWORD = (New-LocalSecret)
        RABBITMQ_USER = 'clinora'
        RABBITMQ_PASSWORD = (New-LocalSecret)
        RABBITMQ_ERLANG_COOKIE = (New-LocalSecret)
        MINIO_ROOT_USER = 'clinora-integration'
        MINIO_ROOT_PASSWORD = (New-LocalSecret)
        JWT_SECRET = (New-LocalSecret)
        RATE_LIMIT_KEY_SECRET = (New-LocalSecret)
        CLINORA_RESEARCH_PSEUDONYM_SECRET = (New-LocalSecret)
        OCR_INTERNAL_TOKEN = (New-LocalSecret)
        AI_INTERNAL_TOKEN = (New-LocalSecret)
        SYSTEM_ADMIN_EMAIL = 'stage2-admin@example.invalid'
        SYSTEM_ADMIN_PASSWORD = ('Integration!1-' + (New-LocalSecret))
        SYSTEM_ADMIN_FIRST_NAME = 'Integration'
        SYSTEM_ADMIN_LAST_NAME = 'Administrator'
        CLINORA_DEV_DOCTORS_ENABLED = 'false'
        BLOOD_NETWORK_DEMO_SEED_ENABLED = 'false'
    }
    $settings.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" } |
        Set-Content -LiteralPath $integrationEnv -Encoding ascii
    Write-Host 'Generated local credentials in ignored .env.integration. Keep this file private.'
}
Invoke-Checked 'git' @('check-ignore', '--quiet', '.env.integration')
Invoke-Checked 'mvn.cmd' @('-B', '-f', 'backend/pom.xml', 'verify')
Push-Location -LiteralPath (Join-Path $integrationRoot 'frontend')
try {
    Invoke-Checked 'npm.cmd' @('ci')
    foreach ($check in @('typecheck', 'lint', 'format:check', 'test', 'build')) {
        Invoke-Checked 'npm.cmd' @('run', $check)
    }
} finally { Pop-Location }

Invoke-Checked 'docker' @('compose', '-p', 'clinora-integration-stage2', '--env-file', '.env.integration',
    '-f', 'docker-compose.yml', '-f', 'docker-compose.integration.yml', 'up', '-d', '--build',
    'backend', 'frontend', 'ocr-service')
Write-Host 'Integration UI: http://localhost:5174. Backend health: http://localhost:8084/actuator/health'
Write-Host 'Start the existing host AI runtime separately as described in docs/development/integration-setup.md.'

param(
    [string]$ProjectRoot = $PSScriptRoot,
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"

function Show-ExternalStatus {
    param([string]$Name, [string]$Url, [string]$ExpectedStatus)
    try {
        $result = Invoke-RestMethod -Uri $Url -TimeoutSec 5
        if ($result.status -ne $ExpectedStatus) { throw "Unexpected readiness status" }
        Write-Host "$Name ready: $Url"
    }
    catch {
        Write-Warning "$Name unavailable or not ready at $Url. Start it manually using the commands below."
    }
}

Push-Location -LiteralPath $ProjectRoot
try {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "Start Docker Desktop, then run this script again." }

    # Stop a previously opted-in container to release :8001; retain it and all volumes.
    docker compose --profile container-ai stop ai-service
    if ($LASTEXITCODE -ne 0) { throw "Could not stop the optional Docker AI service." }

    # Explicit selection also prevents COMPOSE_PROFILES from enabling AI here.
    $services = @("backend", "frontend", "ocr-service", "postgres", "rabbitmq", "redis", "minio", "clamav")
    if ($Rebuild) {
        docker compose up -d --build @services
    }
    else {
        docker compose up -d @services
    }
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }
    docker compose ps
    if ($LASTEXITCODE -ne 0) { throw "docker compose ps failed." }

    $aiUrl = docker compose exec -T backend printenv AI_SERVICE_URL
    if ($LASTEXITCODE -ne 0) { throw "Could not check backend AI_SERVICE_URL." }
    if ($aiUrl.Trim() -ne "http://host.docker.internal:8001") {
        Write-Warning "Backend AI_SERVICE_URL differs from the normal host AI route. Check COMPOSE_AI_SERVICE_URL."
    }
    else { Write-Host "Backend AI_SERVICE_URL=$aiUrl" }

    Show-ExternalStatus "llama-server :8002" "http://127.0.0.1:8002/health" "ok"
    Show-ExternalStatus "FastAPI :8001" "http://127.0.0.1:8001/ready" "READY"
    Write-Host "Frontend: http://localhost:5173"
    Write-Host "Start external AI in separate terminals (FastAPI commands from repo root):"
    Write-Host 'llama-server -hf gguf-org/medgemma-1.5-4b-it-gguf:Q4_0 --no-mmproj --device Vulkan1 --gpu-layers auto --fit on --parallel 1 -c 8192 --host 127.0.0.1 --port 8002'
    Write-Host 'cd ai-service'
    Write-Host '.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --log-level info'
}
finally {
    Pop-Location
}

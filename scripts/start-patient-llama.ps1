# Starts one explicitly selected local llama runtime. Never stops an existing process.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$LlamaServer,
    [Parameter(Mandatory = $true)][string]$ModelPath,
    [string]$Device = 'Vulkan1',
    # Keep portable defaults; the measured RTX 3050 Ti profile uses 640 and on.
    [ValidateRange(640, 4096)][int]$FitMarginMiB = 1024,
    [ValidateSet('auto', 'on', 'off')][string]$FlashAttention = 'auto',
    [ValidateRange(1, 65535)][int]$Port = 8002
)

$ErrorActionPreference = 'Stop'
$launchMutex = New-Object System.Threading.Mutex($false, 'Local\ClinoraPatientLlamaStartup')
$locked = $false
$runtime = $null
try {
    try { $locked = $launchMutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw 'Another Clinora llama startup is in progress.' }
    $existing = @(Get-Process -Name 'llama-server' -ErrorAction SilentlyContinue)
    if ($existing.Count -gt 0) {
        throw "A llama-server process already exists (PID $($existing.Id -join ', ')). Verify its port owner and stop it explicitly before switching runtimes."
    }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $Port already has a listener. No runtime was started."
    }
    $binary = (Resolve-Path -LiteralPath $LlamaServer).Path
    $model = (Resolve-Path -LiteralPath $ModelPath).Path
    if ([IO.Path]::GetFileName($binary) -ne 'llama-server.exe') { throw 'Select llama-server.exe explicitly.' }
    if ($binary.Contains('"') -or $model.Contains('"') -or $Device -notmatch '^[A-Za-z0-9_:,.-]+$') {
        throw 'Invalid runtime argument.'
    }
    $logDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'tmp'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $arguments = @('-m', ('"' + $model + '"'), '--no-mmproj', '--device', $Device,
        '--gpu-layers', 'auto', '--fit', 'on', '--fit-target', $FitMarginMiB,
        '--flash-attn', $FlashAttention, '--parallel', '1', '-c', '8192',
        '--host', '127.0.0.1', '--port', $Port)
    $runtime = Start-Process -FilePath $binary -ArgumentList $arguments -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDirectory "llama-$stamp.stdout.log") `
        -RedirectStandardError (Join-Path $logDirectory "llama-$stamp.stderr.log")
    $deadline = (Get-Date).AddSeconds(120)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        $runtime.Refresh()
        if ($runtime.HasExited) { throw "Selected runtime exited with code $($runtime.ExitCode); inspect its startup log." }
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($listener) {
            if (@($listener | Where-Object OwningProcess -ne $runtime.Id).Count -gt 0) {
                throw 'A different process owns the inference port; refusing to report successful startup.'
            }
            try {
                $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 2
                if ($health.status -eq 'ok') { $ready = $true; break }
            } catch { }
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Selected runtime did not become ready within 120 seconds.' }
    $props = Invoke-RestMethod "http://127.0.0.1:$Port/props" -TimeoutSec 5
    if ($props.total_slots -ne 1 -or $props.default_generation_settings.n_ctx -ne 8192) {
        throw 'Runtime context/slot configuration does not match the Patient baseline.'
    }
    Write-Output "Ready: PID=$($runtime.Id) port=$Port device=$Device context=8192 parallel=1 fitMarginMiB=$FitMarginMiB flashAttention=$FlashAttention"
    Write-Output "Binary: $binary"
    Write-Output "Build: $($props.build_info)"
} catch {
    # Only clean up the process started by this invocation, never an existing runtime.
    if ($runtime -and -not $runtime.HasExited) { Stop-Process -Id $runtime.Id }
    throw
} finally {
    if ($locked) { $launchMutex.ReleaseMutex() }
    $launchMutex.Dispose()
}

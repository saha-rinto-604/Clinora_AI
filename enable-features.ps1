Write-Host "Enabling Virtual Machine Platform..." -ForegroundColor Cyan
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart

Write-Host "Enabling Windows Subsystem for Linux..." -ForegroundColor Cyan
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All -NoRestart

Write-Host "Setting boot hypervisor..." -ForegroundColor Cyan
bcdedit /set hypervisorlaunchtype auto

Write-Host ""
Write-Host "SUCCESS! Both Windows features are now enabled." -ForegroundColor Green
Write-Host "Restart your PC to complete installation." -ForegroundColor Yellow
Write-Host "Press any key to restart now..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Restart-Computer

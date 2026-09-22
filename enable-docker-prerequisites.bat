@echo off
:: BatchGotAdmin
:-------------------------------------
REM --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting Administrative Privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*:"=""
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

echo =======================================================
echo   Enabling Virtual Machine Platform and WSL for Docker
echo =======================================================
echo.

echo [1/4] Enabling Virtual Machine Platform...
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

echo.
echo [2/4] Enabling Windows Subsystem for Linux...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

echo.
echo [3/4] Enabling Hypervisor in boot configuration...
bcdedit /set hypervisorlaunchtype auto

echo.
echo [4/4] Updating WSL components...
wsl.exe --update

echo.
echo =======================================================
echo   SUCCESS! All required components have been enabled.
echo =======================================================
echo.
echo Your computer MUST be restarted for changes to take effect.
echo.
pause
shutdown /r /t 5 /c "Restarting computer to apply virtualization settings for Docker Desktop..."

@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0enable-features.ps1""' -Verb RunAs"

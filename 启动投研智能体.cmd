@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "runtime\node.exe" (
  "runtime\node.exe" server\index.cjs --ask-key
) else (
  node server\index.cjs --ask-key
)
pause

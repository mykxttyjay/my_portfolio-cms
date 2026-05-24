@echo off
setlocal enabledelayedexpansion

REM Set PATH to use Node v22.22.3 from fnm
set "FNM_DIR=%APPDATA%\fnm\node-versions\v22.22.3\installation"
set "PATH=!FNM_DIR!;%PATH%"

REM Verify Node version
echo Using Node version:
node --version

REM Run dev server
bun run dev

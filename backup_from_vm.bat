@echo off
echo ==========================================
echo VYTALGUARD BACKUP (VM → LOCAL SAFE)
echo ==========================================

set PG_BIN=C:\Program Files\PostgreSQL\17\bin

REM ---------- REMOTE (SOURCE) ----------
set REMOTE_HOST=102.68.84.245
set REMOTE_PORT=5432
set REMOTE_DB=vytalguard
set REMOTE_USER=vytal
set REMOTE_PASSWORD=Divine@2016

REM ---------- LOCAL FILE ----------
set BACKUP_FILE=C:\VytalGuard\backup_vm.sql

echo.
echo [1/2] Pulling DB from VM...

set PGPASSWORD=%REMOTE_PASSWORD%

"%PG_BIN%\pg_dump.exe" ^
 -h %REMOTE_HOST% ^
 -p %REMOTE_PORT% ^
 -U %REMOTE_USER% ^
 -d %REMOTE_DB% ^
 --no-owner ^
 --no-acl ^
 --format=plain ^
 > %BACKUP_FILE%

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Backup failed
 pause
 exit /b 1
)

echo ✔ Backup completed
echo ✔ File saved: %BACKUP_FILE%
echo.

echo [2/2] Optional: Compress backup...

powershell -command "Compress-Archive -Path '%BACKUP_FILE%' -DestinationPath '%BACKUP_FILE%.zip' -Force"

echo ✔ Compressed backup created
echo.

echo ✔ BACKUP SUCCESS 🚀
pause
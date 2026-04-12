@echo off
echo ==========================================
echo VYTALGUARD FULL DB SYNC (LOCAL → SERVER)
echo ⚠️ WILL DELETE ALL SERVER DATA
echo ==========================================

set PG_BIN=C:\Program Files\PostgreSQL\17\bin

REM ---------- LOCAL ----------
set LOCAL_DB=vytalguard
set LOCAL_USER=vytal
set LOCAL_PASSWORD=Divine@2016

REM ---------- REMOTE (USE EXISTING SSH TUNNEL) ----------
set REMOTE_HOST=localhost
set REMOTE_PORT=5433
set REMOTE_DB=vytalguard
set REMOTE_USER=vytal
set REMOTE_PASSWORD=Divine@2016

set DUMP_FILE=C:\VytalGuard\vytalguard_full.sql

echo.
echo ⚠️ Make sure SSH tunnel is already running!
echo.

REM ===============================
echo [1/4] Dumping FULL local database...

set PGPASSWORD=%LOCAL_PASSWORD%

"%PG_BIN%\pg_dump.exe" ^
 -h localhost ^
 -U %LOCAL_USER% ^
 -d %LOCAL_DB% ^
 --no-owner ^
 --no-acl ^
 --clean ^
 --if-exists ^
 > "%DUMP_FILE%"

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Dump failed
 pause
 exit /b 1
)

echo ✔ Dump successful
echo.

REM ===============================
echo [2/4] BACKUP remote database...

set PGPASSWORD=%REMOTE_PASSWORD%

"%PG_BIN%\pg_dump.exe" ^
 -h %REMOTE_HOST% ^
 -p %REMOTE_PORT% ^
 -U %REMOTE_USER% ^
 -d %REMOTE_DB% ^
 > C:\VytalGuard\backup_remote.sql

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Remote backup failed
 pause
 exit /b 1
)

echo ✔ Remote backup saved
echo.

REM ===============================
echo [3/4] Resetting public schema...

echo DROP SCHEMA public CASCADE; CREATE SCHEMA public; > reset.sql

"%PG_BIN%\psql.exe" ^
 -h %REMOTE_HOST% ^
 -p %REMOTE_PORT% ^
 -U %REMOTE_USER% ^
 -d %REMOTE_DB% ^
 -f reset.sql

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Failed to reset DB
 pause
 exit /b 1
)

echo ✔ Database cleaned
echo.

REM ===============================
echo [4/4] Restoring FULL database to server...

"%PG_BIN%\psql.exe" ^
 -h %REMOTE_HOST% ^
 -p %REMOTE_PORT% ^
 -U %REMOTE_USER% ^
 -d %REMOTE_DB% ^
 -f "%DUMP_FILE%" ^
 > restore_full.log

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Restore failed (check restore_full.log)
 pause
 exit /b 1
)

echo.
echo ==========================================
echo ✔ SYNC COMPLETE 🚀
echo ==========================================

pause
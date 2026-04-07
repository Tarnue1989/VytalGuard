@echo off
echo ==========================================
echo VYTALGUARD DB PUSH (PC → VPS)
echo ==========================================

set PG_BIN=C:\Program Files\PostgreSQL\17\bin

REM ---------- LOCAL ----------
set LOCAL_DB=vytalguard
set LOCAL_USER=vytal
set LOCAL_PASSWORD=Divine@2016

REM ---------- REMOTE ----------
set REMOTE_HOST=102.68.84.245
set REMOTE_PORT=5432
set REMOTE_DB=vytalguard
set REMOTE_USER=vytal
set REMOTE_PASSWORD=Divine@2016

set DUMP_FILE=C:\VytalGuard\vytalguard.sql

echo.
echo [1/3] Dumping LOCAL DB...
set PGPASSWORD=%LOCAL_PASSWORD%

"%PG_BIN%\pg_dump.exe" -h localhost -U %LOCAL_USER% -d %LOCAL_DB% --no-owner --no-acl > "%DUMP_FILE%"

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Dump failed
 pause
 exit /b 1
)

echo ✔ Dump OK
echo.

echo [2/3] Cleaning REMOTE DB...
set PGPASSWORD=%REMOTE_PASSWORD%

echo DROP SCHEMA public CASCADE; CREATE SCHEMA public; > reset.sql

"%PG_BIN%\psql.exe" -h %REMOTE_HOST% -p %REMOTE_PORT% -U %REMOTE_USER% -d %REMOTE_DB% -f reset.sql

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Reset failed
 pause
 exit /b 1
)

echo ✔ Remote DB cleaned
echo.

echo [3/3] Restoring to VPS...

"%PG_BIN%\psql.exe" -h %REMOTE_HOST% -p %REMOTE_PORT% -U %REMOTE_USER% -d %REMOTE_DB% -f "%DUMP_FILE%"

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Restore failed
 pause
 exit /b 1
)

echo.
echo ✔ SUCCESS 🚀
pause
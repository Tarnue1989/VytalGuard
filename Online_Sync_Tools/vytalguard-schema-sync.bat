@echo off
echo ==========================================
echo VYTALGUARD SCHEMA SYNC (STRUCTURE ONLY)
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

REM ---------- FILE ----------
set SCHEMA_FILE=C:\VytalGuard\vytalguard_schema.sql

echo.
echo [1/2] Dumping STRUCTURE from LOCAL...

set PGPASSWORD=%LOCAL_PASSWORD%

"%PG_BIN%\pg_dump.exe" ^
-h localhost ^
-U %LOCAL_USER% ^
-d %LOCAL_DB% ^
--schema-only ^
--no-owner ^
--no-acl > "%SCHEMA_FILE%"

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Schema dump failed
 pause
 exit /b 1
)

echo ✔ Schema dump OK
echo.

echo [2/2] Applying STRUCTURE to VPS...

set PGPASSWORD=%REMOTE_PASSWORD%

"%PG_BIN%\psql.exe" ^
-h %REMOTE_HOST% ^
-p %REMOTE_PORT% ^
-U %REMOTE_USER% ^
-d %REMOTE_DB% ^
-f "%SCHEMA_FILE%"

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Schema apply failed (possible existing objects)
 pause
 exit /b 1
)

echo.
echo ✔ SUCCESS 🚀 STRUCTURE UPDATED (NO DATA TOUCHED)
pause
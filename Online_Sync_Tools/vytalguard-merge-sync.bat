@echo off
echo ==========================================
echo VYTALGUARD DB MERGE SYNC (SAFE)
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

REM ---------- FILES ----------
set SCHEMA_FILE=C:\VytalGuard\vytalguard_schema.sql
set DATA_FILE=C:\VytalGuard\vytalguard_data.sql

echo.
echo [1/3] Dumping STRUCTURE (schema)...

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

echo [2/3] Dumping DATA (safe insert)...

"%PG_BIN%\pg_dump.exe" ^
-h localhost ^
-U %LOCAL_USER% ^
-d %LOCAL_DB% ^
--data-only ^
--column-inserts ^
--no-owner ^
--no-acl > "%DATA_FILE%"

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Data dump failed
 pause
 exit /b 1
)

echo ✔ Data dump OK
echo.

echo [3/3] Applying to VPS...

set PGPASSWORD=%REMOTE_PASSWORD%

REM Apply schema first
"%PG_BIN%\psql.exe" ^
-h %REMOTE_HOST% ^
-p %REMOTE_PORT% ^
-U %REMOTE_USER% ^
-d %REMOTE_DB% ^
-f "%SCHEMA_FILE%"

REM Then apply data
"%PG_BIN%\psql.exe" ^
-h %REMOTE_HOST% ^
-p %REMOTE_PORT% ^
-U %REMOTE_USER% ^
-d %REMOTE_DB% ^
-f "%DATA_FILE%"

IF %ERRORLEVEL% NEQ 0 (
 echo ❌ Merge failed (possible duplicates)
 pause
 exit /b 1
)

echo.
echo ✔ SUCCESS 🚀 STRUCTURE UPDATED + DATA MERGED
pause
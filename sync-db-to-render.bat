@echo off
REM ==========================================
REM VytalGuard PostgreSQL Sync Script
REM Local PostgreSQL -> Render PostgreSQL
REM CLEAN + SAFE + FK-CORRECT
REM ==========================================

REM ---------- CONFIG ----------

set PG_BIN=C:\Program Files\PostgreSQL\17\bin

set LOCAL_DB=vytalguard
set LOCAL_USER=vytal
set LOCAL_PASSWORD=Divine@2016

set RENDER_HOST=dpg-d5euademcj7s73arb5cg-a.oregon-postgres.render.com
set RENDER_PORT=5432
set RENDER_DB=vytalguard
set RENDER_USER=vytalguard_weka_user
set RENDER_PASSWORD=xy971aDUNfJImYaDGemVkx0uqQCJ5o38

set DUMP_FILE=C:\VytalGuard\vytalguard.dump

echo.
echo ==========================================
echo VYTALGUARD DATABASE SYNC
echo ==========================================
echo.

REM ---------- STEP 1: DUMP LOCAL DATABASE ----------

echo [1/3] Dumping local database...
echo.

set PGPASSWORD=%LOCAL_PASSWORD%

"%PG_BIN%\pg_dump.exe" -v ^
 -h localhost ^
 -U %LOCAL_USER% ^
 -d %LOCAL_DB% ^
 -Fc ^
 --no-owner ^
 --no-acl ^
 -f %DUMP_FILE%

IF %ERRORLEVEL% NEQ 0 (
 echo.
 echo ❌ ERROR: Local dump failed
 pause
 exit /b 1
)

echo.
echo ✔ Local dump completed
echo.

REM ---------- STEP 2: CLEAN RENDER DATABASE (CRITICAL) ----------

echo [2/3] Cleaning Render database (dropping schema)...
echo.

set PGPASSWORD=%RENDER_PASSWORD%

"%PG_BIN%\psql.exe" ^
 -h %RENDER_HOST% ^
 -p %RENDER_PORT% ^
 -U %RENDER_USER% ^
 -d %RENDER_DB% ^
 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

IF %ERRORLEVEL% NEQ 0 (
 echo.
 echo ❌ ERROR: Failed to clean Render database
 pause
 exit /b 1
)

echo.
echo ✔ Render database cleaned
echo.

REM ---------- STEP 3: RESTORE TO RENDER ----------

echo [3/3] Restoring database to Render...
echo.

"%PG_BIN%\pg_restore.exe" -v ^
 -h %RENDER_HOST% ^
 -p %RENDER_PORT% ^
 -U %RENDER_USER% ^
 -d %RENDER_DB% ^
 --clean ^
 --if-exists ^
 --no-owner ^
 --no-acl ^
 %DUMP_FILE%

IF %ERRORLEVEL% NEQ 0 (
 echo.
 echo ❌ ERROR: Restore failed
 pause
 exit /b 1
)

echo.
echo ==========================================
echo ✔ DATABASE SYNC COMPLETED SUCCESSFULLY
echo ==========================================
echo.

pause
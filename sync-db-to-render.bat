@echo off
REM ==========================================
REM Sync Local PostgreSQL -> Render PostgreSQL
REM ==========================================

REM ---- CONFIG ----
set PG_BIN="C:\Program Files\PostgreSQL\17\bin"
set LOCAL_DB=vytalguard
set LOCAL_USER=postgres
set DUMP_FILE=C:\VytalGuard\vytalguard.dump

set RENDER_HOST=dpg-d5euademcj7s73arb5cg-a.oregon-postgres.render.com
set RENDER_DB=vytalguard
set RENDER_USER=vytalguard_weka_user

echo.
echo === STEP 1: Dump local database ===
%PG_BIN%\pg_dump -h localhost -U %LOCAL_USER% -d %LOCAL_DB% -Fc -f %DUMP_FILE%

IF %ERRORLEVEL% NEQ 0 (
  echo ❌ Local dump failed
  pause
  exit /b 1
)

echo.
echo === STEP 2: Restore into Render database ===
%PG_BIN%\pg_restore ^
  -h %RENDER_HOST% ^
  -U %RENDER_USER% ^
  -d %RENDER_DB% ^
  --clean ^
  --if-exists ^
  %DUMP_FILE%

IF %ERRORLEVEL% NEQ 0 (
  echo ❌ Restore to Render failed
  pause
  exit /b 1
)

echo.
echo ✅ DATABASE SYNC COMPLETED SUCCESSFULLY
pause

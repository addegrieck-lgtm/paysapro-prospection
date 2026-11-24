@echo off
REM ==========================================================================
REM  S&S Social Finder - Signe et Seine
REM  Double-cliquez sur ce fichier pour lancer le logiciel.
REM  1re fois : creation de l'environnement Python et installation (1-2 min).
REM ==========================================================================
chcp 65001 >nul
title S^&S Social Finder
cd /d "%~dp0"

echo.
echo   S^&S Social Finder - Signe et Seine
echo   -----------------------------------
echo.

REM --- 1. Python 3.10 ou plus recent ------------------------------------------
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo [ERREUR] Python n'est pas installe.
  echo          Installez Python 3.12 depuis https://www.python.org/downloads/
  echo          en cochant "Add python.exe to PATH", puis relancez START.bat.
  pause
  exit /b 1
)
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
if errorlevel 1 (
  echo [ERREUR] Python 3.10 ou plus recent est necessaire.
  pause
  exit /b 1
)

REM --- 2. Environnement isole et dependances ----------------------------------
if not exist ".venv\Scripts\python.exe" (
  echo Creation de l'environnement Python...
  %PY% -m venv .venv
  if errorlevel 1 goto :error
)
set "VPY=%~dp0.venv\Scripts\python.exe"
"%VPY%" -c "import fastapi, uvicorn, httpx, pydantic" >nul 2>nul
if errorlevel 1 (
  echo Installation des dependances, patientez...
  "%VPY%" -m pip install --disable-pip-version-check -q -r backend\requirements.txt
  if errorlevel 1 goto :error
)

REM --- 3. Interface (deja construite dans frontend\dist) ----------------------
if not exist "frontend\dist\index.html" (
  echo L'interface n'est pas construite. Tentative avec Node.js...
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERREUR] frontend\dist manquant et Node.js absent. Installez Node.js LTS depuis https://nodejs.org/
    pause
    exit /b 1
  )
  pushd frontend
  call npm install --no-audit --no-fund
  call npm run build
  popd
)

REM --- 4. Deja lance ? On ouvre simplement le navigateur ----------------------
"%VPY%" -c "import socket, sys; s = socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1', 8765)) == 0 else 1)"
if not errorlevel 1 (
  echo Le logiciel est deja lance : ouverture du navigateur.
  start "" http://127.0.0.1:8765
  exit /b 0
)

REM --- 5. Lancement ------------------------------------------------------------
echo Demarrage sur http://127.0.0.1:8765  (fermez cette fenetre pour arreter le logiciel)
echo Donnees : %~dp0data
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:8765"
cd backend
"%VPY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --log-level warning
goto :eof

:error
echo.
echo [ERREUR] L'installation a echoue. Verifiez votre connexion Internet puis relancez START.bat.
echo          Detail technique : data\logs\app.log
pause
exit /b 1

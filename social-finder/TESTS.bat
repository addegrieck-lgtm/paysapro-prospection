@echo off
REM Lance les tests automatises du logiciel (a utiliser apres START.bat une premiere fois).
chcp 65001 >nul
cd /d "%~dp0backend"
"%~dp0.venv\Scripts\python.exe" -m pytest -q
pause

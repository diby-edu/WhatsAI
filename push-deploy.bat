@echo off
REM ══════════════════════════════════════════════════════════
REM   WhatsAI — Deploy en 1 clic (depuis Windows)
REM   Usage: double-clic sur ce fichier ou ".\push-deploy.bat"
REM ══════════════════════════════════════════════════════════

cd /d h:\WHATSAPP\wazzap-clone

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║        🚀 WhatsAI — Push + Deploy                    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

REM 1. Git add + commit + push
echo 📦 Ajout des fichiers modifies...
git add -A

set /p MSG="💬 Message du commit (ou Enter pour 'update'): "
if "%MSG%"=="" set MSG=update

echo.
echo 📝 Commit: %MSG%
git commit -m "%MSG%"

echo.
echo 📤 Push vers GitHub...
git push origin master

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur lors du push ! Verifie ta connexion.
    pause
    exit /b 1
)

echo.
echo ✅ Code poussé sur GitHub !
echo.

REM 2. SSH sur le VPS et lancer deploy.sh
echo 🖥️  Connexion au VPS et lancement du deploiement...
echo.
ssh root@72.62.148.170 "cd ~/WhatsAI && git fetch origin && git reset --hard origin/master && chmod +x deploy.sh && ./deploy.sh"

echo.
echo ══════════════════════════════════════════════════════
echo   ✅ TERMINÉ ! Le site est mis à jour.
echo   🔗 https://wazzapai.com
echo ══════════════════════════════════════════════════════
echo.
pause

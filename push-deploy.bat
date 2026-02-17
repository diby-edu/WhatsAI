@echo off
REM WhatsAI — Deploy automatique (0 interaction)

cd /d h:\WHATSAPP\wazzap-clone

echo.
echo 🚀 WhatsAI — Deploy automatique
echo ================================
echo.

git add -A
git commit -m "deploy %date% %time:~0,5%" 2>nul
git push origin master

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur push. Verifie ta connexion.
    pause
    exit /b 1
)

echo ✅ Push OK
echo 🖥️  Deploiement sur le VPS...
echo.

ssh root@72.62.148.170 "cd ~/WhatsAI && git fetch origin && git reset --hard origin/master && chmod +x deploy.sh && ./deploy.sh"

echo.
echo ✅ Termine ! https://wazzapai.com
pause

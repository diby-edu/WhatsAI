@echo off
chcp 65001 >nul
REM WhatsAI — Deploy VPS (Push + Build + Restart)
REM Le commit est fait AVANT par toi ou par l'IA

cd /d h:\WHATSAPP\wazzap-clone

echo.
echo 🚀 WhatsAI — Deploiement VPS
echo =============================
echo.

echo 📤 Push vers GitHub...
git push origin master

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur push ! Verifie que tu as fait un commit avant.
    pause
    exit /b 1
)

echo ✅ Push OK
echo.
echo 🖥️  Deploiement sur le VPS...
echo.

ssh -o ConnectTimeout=30 -o ServerAliveInterval=10 root@72.62.148.170 "cd ~/WhatsAI && git fetch origin && git reset --hard origin/master && chmod +x deploy.sh && ./deploy.sh"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Erreur deploiement sur le VPS !
    pause
    exit /b 1
)

echo.
echo ✅ Deploy termine ! https://wazzapai.com
pause

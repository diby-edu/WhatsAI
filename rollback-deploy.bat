@echo off
REM WhatsAI — Rollback (revenir en arriere)

echo.
echo ⏪ WhatsAI — Rollback
echo =====================
echo.
echo ⚠️  Cela va revenir au commit PRECEDENT sur le VPS.
echo.

ssh root@72.62.148.170 "cd ~/WhatsAI && chmod +x rollback.sh && ./rollback.sh"

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur rollback !
    pause
    exit /b 1
)

echo.
echo ✅ Rollback termine ! https://wazzapai.com
pause

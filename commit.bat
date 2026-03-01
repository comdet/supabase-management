@echo off
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
git add .
git commit -m "chore: release version v2.1.1"
git tag v2.1.1
git push origin main
git push origin v2.1.1
del commit.bat

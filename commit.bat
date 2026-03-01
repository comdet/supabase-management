@echo off
git add .
git commit -m "chore: release version v2.1.0"
git tag -d v2.1.0
git tag v2.1.0
git push origin main
git push origin v2.1.0 -f
del commit.bat

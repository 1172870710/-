@echo off
echo 正在关闭游戏服务器（端口 3001）...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr LISTENING') do (
    taskkill //F //PID %%a >nul 2>&1
)
echo 已关闭
pause

@echo off
chcp 65001 >nul
title 像素沙盒

echo ============================
echo   像素沙盒 - 游戏启动器
echo ============================
echo.

:: 查找项目目录
set PROJECT_DIR=%~dp0

:: 1. 先 Kill 旧的
taskkill /F /IM node.exe >nul 2>&1

:: 2. 启动（含服务 + 桌面窗口）
echo [1/2] 启动游戏服务器和桌面窗口...
start /B "" "%PROJECT_DIR%node_modules\.bin\node.cmd" "%PROJECT_DIR%app\launcher.js"

:: 3. 等待一小会儿，等窗口打开
timeout /t 3 /nobreak >nul

echo.
echo 游戏已启动！关闭游戏窗口后，按 0 然后回车停止服务。
echo 如果不小心关了窗口，按 0 重启即可。
echo.

:: 4. 等待用户按 0 退出
:wait
set /p input="输入 0 后回车停止服务: "
if not "%input%"=="0" goto wait

:: 5. 关闭服务
taskkill /F /IM node.exe >nul 2>&1
echo 服务已停止。
pause

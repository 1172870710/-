// 游戏启动器 —— 启动服务 + Edge/Chrome 桌面窗口（无地址栏）
// Edge --app 模式提供类似 Electron 的桌面体验，零额外依赖
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = 3001;

// 查找可用的 Chromium 浏览器（支持 --app 模式）
function findBrowser() {
  const candidates = [
    { name: 'Edge', path: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
    { name: 'EdgeCore', path: 'C:/Program Files (x86)/Microsoft/EdgeCore/148.0.3967.70/msedge.exe' },
    { name: 'Chrome', path: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
    { name: 'Chrome x86', path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' },
  ];
  for (const c of candidates) {
    if (fs.existsSync(c.path)) return c;
  }
  return null;
}

// 等待服务就绪
function waitForServer(timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      http.get(`http://localhost:${PORT}/debug`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else if (Date.now()-start < timeout) setTimeout(check, 300);
        else resolve(false);
      }).on('error', () => {
        if (Date.now()-start < timeout) setTimeout(check, 300);
        else resolve(false);
      });
    }
    check();
  });
}

async function main() {
  const nodePath = process.execPath;
  const serverScript = path.join(ROOT, 'server', 'index.js');

  console.log('启动游戏服务...');

  // 1. 启动游戏服务
  const gameServer = spawn(nodePath, [serverScript], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let serverAlive = true;
  gameServer.stdout.on('data', (d) => {
    const m = d.toString().trim();
    if (m && !m.startsWith('  NPC:')) console.log('  [server]', m);
  });
  gameServer.stderr.on('data', (d) => {
    const m = d.toString().trim();
    if (m) console.log('  [server]', m);
  });
  gameServer.on('exit', (code) => {
    serverAlive = false;
    if (code !== 0) console.log('  [server] 异常退出，码:', code);
  });

  // 2. 等服务就绪
  const ready = await waitForServer(15000);
  if (ready) console.log('服务已就绪');
  else console.log('服务启动超时，仍尝试打开窗口...');

  // 3. 打开桌面窗口
  const browser = findBrowser();
  const url = `http://localhost:${PORT}`;

  if (browser) {
    console.log(`使用 ${browser.name} 桌面窗口模式...`);
    // --app 模式 = 无地址栏、无标签页的独立窗口
    spawn(browser.path, [
      `--app=${url}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=960,720',
    ], { windowsHide: false, stdio: 'ignore' });
  } else {
    console.log('未找到 Edge/Chrome，用系统默认浏览器打开...');
    spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: false, stdio: 'ignore' });
  }

  console.log('');
  console.log('══════════════════════════════════');
  console.log('  游戏窗口已打开！');
  console.log('  关闭窗口后按 Ctrl+C 停止服务');
  console.log('  或访问: ' + url);
  console.log('══════════════════════════════════');
  console.log('');

  // 4. 中断处理
  process.on('SIGINT', () => {
    console.log('正在关闭...');
    gameServer.kill();
    process.exit(0);
  });

  // 5. 保持运行直到 Ctrl+C
  // 每 5 秒检查服务器是否还活着
  const interval = setInterval(() => {
    if (!serverAlive) {
      console.log('服务已停止');
      clearInterval(interval);
      process.exit(0);
    }
  }, 5000);
}

main().catch(err => {
  console.error('启动失败:', err.message);
  process.exit(1);
});

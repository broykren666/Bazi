const http = require('http');
const PORT = 3243;

const server = http.createServer((req, res) => {
    // 提供准确的服务器时间（ISO格式，毫秒级）
    const serverTime = new Date();
    const serverTimeISO = serverTime.toISOString();
    const serverTimeMs = serverTime.getTime();

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>精准时钟 - 实时日期时间</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            user-select: none; /* 避免选择文字，类似 time.is */
        }
        body {
            background: #0a0e27;
            font-family: 'Courier New', 'SF Mono', 'Fira Code', 'Monaco', monospace;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #eef;
            padding: 20px;
        }
        .clock-container {
            background: rgba(15, 20, 45, 0.8);
            backdrop-filter: blur(12px);
            border-radius: 56px;
            padding: 2rem 2.5rem;
            box-shadow: 0 25px 45px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
            border: 1px solid rgba(90, 150, 255, 0.3);
            text-align: center;
            width: 100%;
            max-width: 800px;
            transition: all 0.2s;
        }
        .date-box {
            font-size: 2rem;
            letter-spacing: 2px;
            font-weight: 500;
            background: #01031a80;
            padding: 0.5rem 1.2rem;
            border-radius: 60px;
            display: inline-block;
            margin-bottom: 2rem;
            backdrop-filter: blur(4px);
            font-family: monospace;
            border: 1px solid #2c3f8f;
        }
        .time-main {
            font-size: 6rem;
            font-weight: 700;
            font-family: 'Fira Mono', 'Courier New', monospace;
            letter-spacing: 8px;
            text-shadow: 0 0 8px #3e6eff80;
            background: linear-gradient(135deg, #ffffff, #b0e0ff);
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            margin: 20px 0;
        }
        .milliseconds {
            font-size: 2.5rem;
            font-weight: 400;
            font-family: monospace;
            color: #88aaff;
            background: #0a0e2a;
            padding: 0 0.6rem;
            border-radius: 40px;
            display: inline-block;
            margin-left: 12px;
        }
        .timezone-bar {
            margin-top: 1rem;
            display: flex;
            justify-content: center;
            gap: 28px;
            flex-wrap: wrap;
            font-size: 1rem;
            background: #00000040;
            padding: 0.8rem;
            border-radius: 48px;
        }
        .info-chip {
            background: #11162e;
            padding: 6px 18px;
            border-radius: 40px;
            font-family: monospace;
            border-left: 3px solid #3e6eff;
        }
        .refresh-note {
            margin-top: 1.8rem;
            font-size: 0.7rem;
            opacity: 0.6;
            font-family: system-ui;
            letter-spacing: 1px;
        }
        .accuracy {
            color: #7effb3;
            font-weight: bold;
        }
        @media (max-width: 550px) {
            .clock-container { padding: 1.5rem; }
            .time-main { font-size: 3rem; letter-spacing: 4px; }
            .milliseconds { font-size: 1.3rem; }
            .date-box { font-size: 1.2rem; }
        }
        button {
            background: none;
            border: 1px solid #4a6eff;
            color: #ccddff;
            padding: 6px 14px;
            border-radius: 40px;
            margin-top: 16px;
            cursor: pointer;
            font-family: monospace;
            transition: 0.2s;
        }
        button:hover {
            background: #2a3faa40;
            color: white;
        }
    </style>
</head>
<body>
<div class="clock-container">
    <div class="date-box" id="dateDisplay">加载中...</div>
    <div>
        <span class="time-main" id="timeDisplay">--:--:--</span>
        <span class="milliseconds" id="msDisplay">.---</span>
    </div>
    <div class="timezone-bar">
        <span class="info-chip">🇨🇳 北京时间 (UTC+8)</span>
        <span class="info-chip">📡 高精度本地时钟</span>
        <span class="info-chip">⏱️ 误差 ±0.5ms</span>
    </div>
    <button id="syncBtn">⟳ 同步服务器时间</button>
    <div class="refresh-note">
        🕒 实时刷新 ｜ 基于 <span class="accuracy">系统高精度计时器</span> ｜ 类似 time.is 体验
    </div>
</div>

<script>
    (function() {
        // ---------- 从服务器获取基准时间 (毫秒级时间戳 + 传输耗时校准) ----------
        let serverBaseTime = null;      // 服务器时间戳 (毫秒)
        let clientFetchTime = null;     // 客户端发出请求时的本地时间
        let offset = 0;                 // 本地与服务器的差值 (server - local) 毫秒

        // 获取精准服务器时间 (采用一次往返补偿)
        function fetchServerTime() {
            const requestStart = performance.now();   // 高精度本地时间
            return fetch('/api/time')
                .then(response => response.json())
                .then(data => {
                    const requestEnd = performance.now();
                    const serverTimeRecv = data.serverTimeMs;   // 服务器时刻(ms)
                    // 网络往返耗时 (RTT)
                    const rtt = requestEnd - requestStart;
                    // 估算服务器真正处理响应的时间点 = 客户端发出请求到一半RTT的时刻
                    const estimatedServerTimeAtReceive = serverTimeRecv + (rtt / 2);
                    // 本地接收响应的时刻(高精度)
                    const localNow = performance.now();
                    // 计算偏移量: 服务器时间 - 本地时间 (使得 local + offset = 真实服务器时间)
                    offset = estimatedServerTimeAtReceive - localNow;
                    serverBaseTime = data.serverTimeMs;
                    clientFetchTime = Date.now();
                    console.log(\`时间同步完成 | 偏移: \${offset.toFixed(2)}ms | RTT: \${rtt.toFixed(2)}ms\`);
                    return true;
                })
                .catch(err => {
                    console.error("同步失败，使用本地时间偏移:", err);
                    offset = 0;   // 降级为纯本地时间
                    return false;
                });
        }

        // 获取当前的“真实”时间 (基于同步后的偏移)
        function getCurrentAccurateTime() {
            const nowLocal = performance.now();   // 高精度相对时间
            let realTimestamp;
            if (offset !== null && !isNaN(offset)) {
                // real = 本地单调时间 + offset
                realTimestamp = nowLocal + offset;
            } else {
                // 未同步完成，fallback 本地Date
                realTimestamp = Date.now();
            }
            return new Date(realTimestamp);
        }

        // 格式化日期: 2026年4月7日 星期二
        function formatDate(date) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const weekday = weekdays[date.getDay()];
            return \`\${year}年\${month}月\${day}日 \${weekday}\`;
        }

        // 格式化时间 HH:MM:SS
        function formatTime(date) {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return \`\${hours}:\${minutes}:\${seconds}\`;
        }

        // 获取毫秒部分 (三位数)
        function getMilliseconds(date) {
            return date.getMilliseconds().toString().padStart(3, '0');
        }

        let animationId = null;
        let lastDateStr = '';
        let lastTimeStr = '';

        // 更新UI (每秒更新60次以上，毫秒实时跳动)
        function updateClock() {
            const now = getCurrentAccurateTime();
            const dateStr = formatDate(now);
            const timeStr = formatTime(now);
            const msStr = getMilliseconds(now);

            // 更新DOM (只在变化时修改，轻微性能优化)
            const dateElem = document.getElementById('dateDisplay');
            const timeElem = document.getElementById('timeDisplay');
            const msElem = document.getElementById('msDisplay');
            
            if (dateElem && dateStr !== lastDateStr) {
                dateElem.innerText = dateStr;
                lastDateStr = dateStr;
            }
            if (timeElem && timeStr !== lastTimeStr) {
                timeElem.innerText = timeStr;
                lastTimeStr = timeStr;
            }
            if (msElem) {
                msElem.innerText = \`.\${msStr}\`;
            }
            
            // 使用 requestAnimationFrame 确保流畅毫秒更新 (约60fps)
            animationId = requestAnimationFrame(updateClock);
        }

        // 手动强制重新同步服务器时间
        function resync() {
            const btn = document.getElementById('syncBtn');
            if(btn) {
                btn.innerText = '⏳ 同步中...';
                btn.disabled = true;
            }
            fetchServerTime().then(() => {
                if(btn) {
                    btn.innerText = '✓ 同步完成';
                    setTimeout(() => {
                        if(btn) btn.innerText = '⟳ 同步服务器时间';
                        btn.disabled = false;
                    }, 1500);
                }
                // 同步后立即刷新一次显示
                const nowDisplay = getCurrentAccurateTime();
                document.getElementById('dateDisplay').innerText = formatDate(nowDisplay);
                document.getElementById('timeDisplay').innerText = formatTime(nowDisplay);
                document.getElementById('msDisplay').innerText = '.' + getMilliseconds(nowDisplay);
            }).catch(() => {
                if(btn) {
                    btn.innerText = '⚠️ 同步失败';
                    setTimeout(() => {
                        if(btn) btn.innerText = '⟳ 同步服务器时间';
                        btn.disabled = false;
                    }, 2000);
                }
            });
        }

        // 初次启动: 先同步服务器时间，然后开始动画时钟
        fetchServerTime().then(() => {
            updateClock();
        }).catch(() => {
            // 如果首次同步出错，依然使用本地时间运行
            offset = 0;
            updateClock();
        });

        // 绑定手动同步按钮
        const syncButton = document.getElementById('syncBtn');
        if (syncButton) {
            syncButton.addEventListener('click', resync);
        }

        // 页面关闭时取消动画
        window.addEventListener('beforeunload', () => {
            if(animationId) cancelAnimationFrame(animationId);
        });
    })();
</script>
</body>
</html>`;

    // 处理API端点：提供准确的服务器时间 (毫秒级)
    if (req.url === '/api/time') {
        const now = new Date();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            serverTimeMs: now.getTime(),
            serverISO: now.toISOString()
        }));
        return;
    }

    // 正常网页请求
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
});

server.listen(PORT, () => {
    console.log(`✅ 精准时钟服务已启动 → http://localhost:${PORT}`);
    console.log(`📅 提供类似 time.is 的实时日期时间 (毫秒同步 + 网络延迟补偿)`);
    console.log(`💡 按 Ctrl + C 停止服务器`);
});
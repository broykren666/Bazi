const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Solar, Lunar } = require('lunar-javascript');

// 生肖映射 (基于地支)
const branchToZodiac = {
    '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔', '辰': '龙', '巳': '蛇',
    '午': '马', '未': '羊', '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪'
};

// 验证日期范围（lunar-calendar 支持 1900-2100）
function isValidDateRange(year, month, day) {
    return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// 计算八字（四柱）
function calculateBazi(solarYear, solarMonth, solarDay, hour) {
    try {
        const solar = Solar.fromYmdHms(solarYear, solarMonth, solarDay, hour, 0, 0);
        const lunar = solar.getLunar();
        const eightChar = lunar.getEightChar();

        // 获取四柱干支
        const yearPillar = eightChar.getYear();
        const monthPillar = eightChar.getMonth();
        const dayPillar = eightChar.getDay();
        const timePillar = eightChar.getTime();

        // 五行统计（表面天干地支）
        const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
        const pillarsWuXing = [
            eightChar.getYearWuXing(),
            eightChar.getMonthWuXing(),
            eightChar.getDayWuXing(),
            eightChar.getTimeWuXing()
        ];
        
        pillarsWuXing.forEach(wx => {
            // wx 是类似 "金木" 的字符串，包含干和支的五行
            for (let char of wx) {
                if (wuxingCount.hasOwnProperty(char)) {
                    wuxingCount[char]++;
                }
            }
        });

        return {
            year: yearPillar,
            month: monthPillar,
            day: dayPillar,
            time: timePillar,
            zodiac: branchToZodiac[yearPillar.charAt(1)],
            wuxing: wuxingCount,
            lunarYear: lunar.getYear(),
            lunarMonth: lunar.getMonth(),
            lunarDay: lunar.getDay(),
            isLeap: lunar.getMonth() < 0
        };
    } catch (err) {
        console.error('八字计算错误:', err);
        return null;
    }
}
// 使用环境变量中的 PORT，如果没有则用 8100 作为备选
const PORT = process.env.PORT || 8100;
// 监听 IPv6 地址（Alwaysdata 要求）
const HOST = '::';  // 添加这一行，放在 PORT 定义附近
const REQUEST_TIMEOUT = 10000; // 10秒超时

// 定义MIME类型
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 处理API端点：提供准确的UTC时间（优先time.is，失败降级本地）
    if (pathname === '/api/time') {
        // 缓存time.is结果（30秒内不重复请求）
        if (server._cachedTimeIs && Date.now() - server._cachedTimeIs.ts < 30000) {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                utcTimeMs: server._cachedTimeIs.ms,
                serverISO: new Date(server._cachedTimeIs.ms).toISOString(),
                source: 'time.is (cached)'
            }));
            return;
        }

        // 请求time.is API
        const req = https.get('https://time.is/Unix_time', { timeout: 3000 }, (resTime) => {
            let data = '';
            resTime.on('data', chunk => { data += chunk; });
            resTime.on('end', () => {
                try {
                    // time.is 返回纯文本Unix时间戳
                    const unixTimeMs = parseInt(data.trim()) * 1000;
                    if (!isNaN(unixTimeMs) && unixTimeMs > 1000000000000) {
                        server._cachedTimeIs = { ms: unixTimeMs, ts: Date.now() };
                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({
                            utcTimeMs: unixTimeMs,
                            serverISO: new Date(unixTimeMs).toISOString(),
                            source: 'time.is'
                        }));
                        return;
                    }
                } catch (e) {}
                fallbackToLocal(res);
            });
        });

        req.on('error', () => {
            fallbackToLocal(res);
        });

        req.on('timeout', () => {
            req.destroy();
            fallbackToLocal(res);
        });
        return;
    }

    function fallbackToLocal(res) {
        const now = new Date();
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            utcTimeMs: now.getTime(),
            serverISO: now.toISOString(),
            source: 'local'
        }));
        return;
    }

    // 处理农历API端点
    if (pathname === '/api/lunar') {
        const year = parseInt(parsedUrl.query.year);
        const month = parseInt(parsedUrl.query.month);
        const day = parseInt(parsedUrl.query.day);
        const hour = parseInt(parsedUrl.query.hour) || 0;

        console.log(`[八字API] 请求: year=${year}, month=${month}, day=${day}, hour=${hour}`);

        if (!isValidDateRange(year, month, day)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '日期超出有效范围（1900-2100年）' }));
            return;
        }

        try {
            const solar = Solar.fromYmdHms(year, month, day, hour, 0, 0);
            const lunar = solar.getLunar();
            
            const lunarStr = `${lunar.getYearInGanZhi()}${branchToZodiac[lunar.getYearInGanZhi().charAt(1)]}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
            const bazi = calculateBazi(year, month, day, hour);

            // 让 lunar-javascript 提供精准节气
            let jieqi = null;
            const prevJie = lunar.getPrevJie();
            const nextJie = lunar.getNextJie();
            
            // 如果当天就是节气
            const solarCurrent = solar.toYmd();
            if (prevJie.getSolar().toYmd() === solarCurrent) jieqi = prevJie.getName();
            if (nextJie.getSolar().toYmd() === solarCurrent) jieqi = nextJie.getName();
            
            // 兜底逻辑：为了兼容原有 UI 显示最近的节气（可选）
            if (!jieqi) {
                const prevQi = lunar.getPrevQi();
                const nextQi = lunar.getNextQi();
                if (prevQi.getSolar().toYmd() === solarCurrent) jieqi = prevQi.getName();
                if (nextQi.getSolar().toYmd() === solarCurrent) jieqi = nextQi.getName();
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                lunarStr,
                bazi,
                jieqi
            }));
        } catch (err) {
            console.error('农历计算错误:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '农历计算失败' }));
        }
        return;
    }

    // 处理农历转公历API端点
    if (pathname === '/api/lunar-to-solar') {
        const year = parseInt(parsedUrl.query.year);
        const month = parseInt(parsedUrl.query.month);
        const day = parseInt(parsedUrl.query.day);
        const isLeap = parsedUrl.query.isLeap === 'true';

        if (!isValidDateRange(year, month, day)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '日期超出有效范围（1900-2100年）' }));
            return;
        }

        try {
            // lunar-javascript 处理闰月非常简单
            // 如果是闰月，month 传原值，isLeapMonth 参数发挥作用
            let lunar;
            if (isLeap) {
                // lunar-javascript 中闰月通过 negative month 表示，或者特定构造
                lunar = Lunar.fromYmd(year, -month, day);
            } else {
                lunar = Lunar.fromYmd(year, month, day);
            }

            const solar = lunar.getSolar();
            if (!solar) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '农历日期不存在，请检查输入' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                solarYear: solar.getYear(),
                solarMonth: solar.getMonth(),
                solarDay: solar.getDay()
            }));
        } catch (err) {
            console.error('农历转公历错误:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '转换失败' }));
        }
        return;
    }

    // 处理静态文件请求
    let filePath = '';
    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(__dirname, 'public', 'index.html');
    } else {
        filePath = path.join(__dirname, 'public', pathname);
    }

    // 获取文件扩展名
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // 读取并返回静态文件
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 文件不存在
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - 文件未找到</h1>');
            } else {
                // 服务器错误
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<h1>500 - 服务器错误</h1><p>${err.code}</p>`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
            res.end(content);
        }
    });
});

server._cachedTimeIs = null;
server.setTimeout(REQUEST_TIMEOUT);
server.listen(PORT, HOST, () => {
    console.log(`✅ 精准时钟服务已启动（含农历）→ http://[${HOST}]:${PORT}`);
    console.log(`📅 提供类似 time.is 的实时日期时间 + 农历显示`);
    console.log(`💡 按 Ctrl + C 停止服务器`);
});
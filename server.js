const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const LunarCalendar = require('lunar-calendar');

const PORT = 3243;

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

    // 处理API端点：提供准确的服务器时间
    if (pathname === '/api/time') {
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
    
    // 处理农历API端点
    if (pathname === '/api/lunar') {
        const year = parseInt(parsedUrl.query.year);
        const month = parseInt(parsedUrl.query.month);
        const day = parseInt(parsedUrl.query.day);
        
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '参数错误' }));
            return;
        }
        
        try {
            // 使用 lunar-calendar 库计算农历
            const lunar = LunarCalendar.solarToLunar(year, month, day);
            
            // 格式化农历字符串
            let lunarStr = `${lunar.lunarYear}年 ${lunar.lunarMonth}月${lunar.lunarDay}`;
            if (lunar.isLeap) {
                lunarStr = `闰${lunarStr}`;
            }
            if (lunar.lunarYearName) {
                lunarStr = `${lunar.lunarYearName}年 ${lunarStr.replace(lunar.lunarYear + '年', '')}`;
            }
            // 添加生肖
            const zodiac = lunar.zodiac;
            lunarStr = `${lunarStr} (${zodiac}年)`;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, lunarStr }));
        } catch (err) {
            console.error('农历计算错误:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '农历计算失败' }));
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

server.listen(PORT, () => {
    console.log(`✅ 精准时钟服务已启动（含农历）→ http://localhost:${PORT}`);
    console.log(`📅 提供类似 time.is 的实时日期时间 + 农历显示`);
    console.log(`💡 按 Ctrl + C 停止服务器`);
});
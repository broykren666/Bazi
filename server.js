const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const LunarCalendar = require('lunar-calendar');

// 农历数字转中文
const lunarDigits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

// 将农历数字转换为中文
function toLunarChinese(num) {
    if (num <= 10) return lunarDigits[num];
    if (num < 20) return '十' + lunarDigits[num - 10];
    if (num === 20) return '二十';
    if (num < 30) return '廿' + lunarDigits[num - 20];
    if (num === 30) return '三十';
    return num.toString();
}

// 天干
const heavenlyStems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 地支
const earthlyBranches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 生肖
const zodiacs = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
// 五行
const stemWuxing = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
    '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};
const branchWuxing = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土',
    '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

// 验证日期范围（lunar-calendar 支持 1900-2100）
function isValidDateRange(year, month, day) {
    return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// 计算八字（四柱）
function calculateBazi(solarYear, solarMonth, solarDay, hour) {
    try {
        const lunar = LunarCalendar.solarToLunar(solarYear, solarMonth, solarDay);

        // 年柱
        const yearIndex = (lunar.lunarYear - 4) % 60;
        const yearStemIndex = yearIndex % 10;
        const yearBranchIndex = yearIndex % 12;
        const yearStem = heavenlyStems[yearStemIndex];
        const yearBranch = earthlyBranches[yearBranchIndex];
        const yearPillar = yearStem + yearBranch;

        // 月柱：五虎遁（根据年干推算月干）
        const lunarMonth = lunar.lunarMonth;
        const monthBranchIdx = (lunarMonth + 1) % 12;
        const monthStemStart = (yearStemIndex % 5) * 2;
        const monthStemIdx = (monthStemStart + lunarMonth - 1) % 10;
        const monthStem = heavenlyStems[monthStemIdx];
        const monthBranch = earthlyBranches[monthBranchIdx];
        const monthPillar = monthStem + monthBranch;

        // 日柱：基于公历日期计算
        const baseDate = new Date(1900, 0, 31);
        const targetDate = new Date(solarYear, solarMonth - 1, solarDay);
        const dayDiff = Math.floor((targetDate - baseDate) / (24 * 60 * 60 * 1000));
        const dayIndex = ((dayDiff % 60) + 60) % 60;
        const dayStemIdx = dayIndex % 10;
        const dayBranchIdx = dayIndex % 12;
        const dayStem = heavenlyStems[dayStemIdx];
        const dayBranch = earthlyBranches[dayBranchIdx];
        const dayPillar = dayStem + dayBranch;

        // 时柱：五鼠遁
        const timeBranchIdx = Math.floor(((hour + 1) % 24) / 2) % 12;
        const timeStemStart = (dayStemIdx % 5) * 2;
        const timeStemIdx = (timeStemStart + timeBranchIdx) % 10;
        const timeStem = heavenlyStems[timeStemIdx];
        const timeBranch = earthlyBranches[timeBranchIdx];
        const timePillar = timeStem + timeBranch;

        // 生肖
        const zodiacIndex = (lunar.lunarYear - 4) % 12;
        const zodiac = zodiacs[zodiacIndex];

        // 五行统计
        const pillars = [yearPillar, monthPillar, dayPillar, timePillar];
        const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
        pillars.forEach(p => {
            wuxingCount[stemWuxing[p[0]]]++;
            wuxingCount[branchWuxing[p[1]]]++;
        });

        return {
            year: yearPillar,
            month: monthPillar,
            day: dayPillar,
            time: timePillar,
            zodiac,
            wuxing: wuxingCount,
            lunarYear: lunar.lunarYear,
            lunarMonth: lunar.lunarMonth,
            lunarDay: lunar.lunarDay,
            isLeap: lunar.isLeap
        };
    } catch (err) {
        console.error('八字计算错误:', err);
        return null;
    }
}

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

    // 处理API端点：提供准确的UTC时间
    if (pathname === '/api/time') {
        const now = new Date();
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            utcTimeMs: now.getTime(),
            serverISO: now.toISOString()
        }));
        return;
    }

    // 处理农历API端点
    if (pathname === '/api/lunar') {
        const year = parseInt(parsedUrl.query.year);
        const month = parseInt(parsedUrl.query.month);
        const day = parseInt(parsedUrl.query.day);
        const hour = parseInt(parsedUrl.query.hour) || 0;

        if (!isValidDateRange(year, month, day)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '日期超出有效范围（1900-2100年）' }));
            return;
        }

        try {
            const lunar = LunarCalendar.solarToLunar(year, month, day);

            const yearIndex = (lunar.lunarYear - 4) % 60;
            const stemIndex = yearIndex % 10;
            const branchIndex = yearIndex % 12;
            const ganzhi = heavenlyStems[stemIndex] + earthlyBranches[branchIndex];

            const zodiacIndex = (lunar.lunarYear - 4) % 12;
            const zodiac = zodiacs[zodiacIndex];

            const yearChinese = toLunarChinese(lunar.lunarYear);
            const monthChinese = toLunarChinese(lunar.lunarMonth);
            const dayChinese = toLunarChinese(lunar.lunarDay);

            let lunarStr = `${ganzhi}${zodiac}年 ${monthChinese}月${dayChinese}`;
            if (lunar.isLeap) {
                lunarStr = `闰${lunarStr}`;
            }

            const bazi = calculateBazi(year, month, day, hour);

            // 计算节气（简化版：基于常见日期范围）
            let jieqi = null;
            const jieqiDates = {
                1: ['小寒', 5, '大寒', 20],
                2: ['立春', 4, '雨水', 19],
                3: ['惊蛰', 6, '春分', 21],
                4: ['清明', 5, '谷雨', 20],
                5: ['立夏', 6, '小满', 21],
                6: ['芒种', 6, '夏至', 21],
                7: ['小暑', 7, '大暑', 23],
                8: ['立秋', 8, '处暑', 23],
                9: ['白露', 8, '秋分', 23],
                10: ['寒露', 8, '霜降', 23],
                11: ['立冬', 7, '小雪', 22],
                12: ['大雪', 7, '冬至', 22]
            };
            
            if (jieqiDates[month]) {
                const [jieqi1Name, jieqi1Day, jieqi2Name, jieqi2Day] = jieqiDates[month];
                if (Math.abs(day - jieqi1Day) <= 1) jieqi = jieqi1Name;
                else if (Math.abs(day - jieqi2Day) <= 1) jieqi = jieqi2Name;
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
            // 农历月份天数校验：先尝试获取该农历月实际最大天数
            let maxDay = 0;
            // 尝试两种可能（非闰月和闰月）
            for (let leap of [false, true]) {
                try {
                    const test = LunarCalendar.lunarToSolar(year, month, 1, { isLeapMonth: leap });
                    if (test && test.year) {
                        // 逐日测试找到最大有效日
                        for (let d = 30; d >= 28; d--) {
                            const t = LunarCalendar.lunarToSolar(year, month, d, { isLeapMonth: leap });
                            if (t && t.year && t.month === test.month) {
                                maxDay = Math.max(maxDay, d);
                                break;
                            }
                        }
                    }
                } catch (e) {}
            }
            if (maxDay === 0) maxDay = 30; // 兜底
            
            if (day > maxDay) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `农历${year}年${month}月只有${maxDay}天` }));
                return;
            }

            let solar;
            if (isLeap) {
                solar = LunarCalendar.lunarToSolar(year, month, day, { isLeapMonth: true });
                if (!solar || !solar.year) {
                    solar = LunarCalendar.lunarToSolar(year, month, day);
                }
            } else {
                solar = LunarCalendar.lunarToSolar(year, month, day);
            }

            if (!solar || !solar.year) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '农历日期不存在，请检查输入' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                solarYear: solar.year,
                solarMonth: solar.month,
                solarDay: solar.day
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

server.listen(PORT, () => {
    console.log(`✅ 精准时钟服务已启动（含农历）→ http://localhost:${PORT}`);
    console.log(`📅 提供类似 time.is 的实时日期时间 + 农历显示`);
    console.log(`💡 按 Ctrl + C 停止服务器`);
});
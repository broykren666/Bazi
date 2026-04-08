(function() {
    // 从服务器获取基准UTC时间 (毫秒级时间戳 + 传输耗时校准)
    let utcBaseTime = null;
    let clientFetchTime = null;
    let offset = 0;

    // 获取精准UTC时间
    let lastTimeSource = '';
    let timeSourceDisplay = 'local';

    function fetchServerTime() {
        const requestStart = performance.now();
        return fetch('/api/time')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                const requestEnd = performance.now();
                const rtt = requestEnd - requestStart;
                const serverTimeRecv = Number(data.utcTimeMs);

                if (!serverTimeRecv || isNaN(serverTimeRecv)) {
                    throw new Error('服务器返回的时间戳无效');
                }

                const estimatedServerTimeAtReceive = serverTimeRecv + (rtt / 2);
                const localNow = Date.now();
                offset = estimatedServerTimeAtReceive - localNow;
                utcBaseTime = serverTimeRecv;
                clientFetchTime = Date.now();

                // 记录时间来源
                const source = data.source || 'local';
                timeSourceDisplay = source;
                if (source !== lastTimeSource) {
                    lastTimeSource = source;
                    const sourceLabel = source === 'time.is (cached)' ? '🕐 time.is (缓存)' :
                                        source === 'time.is' ? '🕐 time.is' : '🖥️ 本地';
                    console.log(`[时间同步] ✅ 来源: ${sourceLabel} | 偏移: ${offset.toFixed(2)}ms | RTT: ${rtt.toFixed(2)}ms`);
                }

                if (rtt > 500) {
                    console.warn(`[时间同步] ⚠️ 网络延迟较高 (${rtt.toFixed(0)}ms)，时间精度可能受影响`);
                }

                return true;
            })
            .catch(err => {
                console.error("[时间同步] ❌ 失败，使用本地时间:", err.message);
                offset = 0;
                lastTimeSource = 'local';
                timeSourceDisplay = 'local';
                return false;
            });
    }

    // 获取当前的真实UTC时间，并转换为本地时区Date对象
    function getCurrentAccurateTime() {
        const localNow = Date.now(); // 使用 Date.now() 与 offset 计算一致
        let realTimestamp;
        if (offset !== null && !isNaN(offset)) {
            realTimestamp = localNow + offset;
        } else {
            realTimestamp = Date.now();
        }
        // 使用 UTC 时间戳创建 Date 对象，然后使用 toLocaleString 等方法按浏览器本地时区显示
        return new Date(realTimestamp);
    }

    // 格式化公历日期
    function formatDate(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[date.getDay()];
        return `${year}年${month}月${day}日 ${weekday}`;
    }

    // 获取并显示浏览器时区信息
    function updateTimezoneDisplay() {
        const timezoneChip = document.getElementById('timezoneChip');
        if (timezoneChip) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const offset = -new Date().getTimezoneOffset();
            const offsetHours = Math.floor(Math.abs(offset) / 60);
            const offsetMinutes = Math.abs(offset) % 60;
            const sign = offset >= 0 ? '+' : '-';
            const offsetStr = `UTC${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;
            timezoneChip.innerHTML = `🌍 ${tz} (${offsetStr})`;
        }
    }

    // 根据小时获取对应时辰
    function getChineseTimePeriod(hours) {
        // 十二时辰对照表
        const shichen = [
            { name: '子时', start: 23, end: 1, emoji: '🌙' },
            { name: '丑时', start: 1, end: 3, emoji: '🐂' },
            { name: '寅时', start: 3, end: 5, emoji: '🐅' },
            { name: '卯时', start: 5, end: 7, emoji: '🐇' },
            { name: '辰时', start: 7, end: 9, emoji: '🐉' },
            { name: '巳时', start: 9, end: 11, emoji: '🐍' },
            { name: '午时', start: 11, end: 13, emoji: '☀️' },
            { name: '未时', start: 13, end: 15, emoji: '🐑' },
            { name: '申时', start: 15, end: 17, emoji: '🐒' },
            { name: '酉时', start: 17, end: 19, emoji: '🐓' },
            { name: '戌时', start: 19, end: 21, emoji: '🐕' },
            { name: '亥时', start: 21, end: 23, emoji: '🐖' }
        ];

        for (let sc of shichen) {
            if (sc.start < sc.end) {
                // 正常跨小时（如 1-3点）
                if (hours >= sc.start && hours < sc.end) {
                    return sc;
                }
            } else {
                // 跨夜（如 23-1点）
                if (hours >= sc.start || hours < sc.end) {
                    return sc;
                }
            }
        }
        return shichen[0]; // 默认子时
    }

    // 更新时辰显示（进度条样式）
    // 十二时辰：子(23-1), 丑(1-3), 寅(3-5), 卯(5-7), 辰(7-9), 巳(9-11), 午(11-13), 未(13-15), 申(15-17), 酉(17-19), 戌(19-21), 亥(21-23)
    const shichenList = [
        { name: '子', start: 23, end: 1, emoji: '🌙' },
        { name: '丑', start: 1, end: 3, emoji: '🐂' },
        { name: '寅', start: 3, end: 5, emoji: '🐅' },
        { name: '卯', start: 5, end: 7, emoji: '🐇' },
        { name: '辰', start: 7, end: 9, emoji: '🐉' },
        { name: '巳', start: 9, end: 11, emoji: '🐍' },
        { name: '午', start: 11, end: 13, emoji: '☀️' },
        { name: '未', start: 13, end: 15, emoji: '🐑' },
        { name: '申', start: 15, end: 17, emoji: '🐒' },
        { name: '酉', start: 17, end: 19, emoji: '🐓' },
        { name: '戌', start: 19, end: 21, emoji: '🐕' },
        { name: '亥', start: 21, end: 23, emoji: '🐖' }
    ];

    function getCurrentShichenIndex(hours) {
        for (let i = 0; i < shichenList.length; i++) {
            const current = shichenList[i];
            if (current.start < current.end) {
                if (hours >= current.start && hours < current.end) {
                    return i;
                }
            } else {
                if (hours >= current.start || hours < current.end) {
                    return i;
                }
            }
        }
        return 0;
    }

    function formatHour(hour) {
        return hour.toString().padStart(2, '0') + ':00';
    }

    // 初始化右侧时辰对照表
    function initShichenReference() {
        const container = document.getElementById('shichenReference');
        if (!container) return null;
        
        function renderReference(currentShichenIndex) {
            let html = '<table class="shichen-reference-table">';
            shichenList.forEach((sc, i) => {
                const isCurrent = i === currentShichenIndex;
                const timeStr = `${formatHour(sc.start)} - ${formatHour(sc.end)}`;
                html += `<tr class="${isCurrent ? 'current' : ''}" data-index="${i}">
                    <td class="ref-emoji">${sc.emoji}</td>
                    <td class="ref-name">${sc.name}时</td>
                    <td class="ref-time">${timeStr}</td>
                </tr>`;
            });
            html += '</table>';
            container.innerHTML = html;
        }
        
        return renderReference;
    }

    const updateShichenReference = initShichenReference();

    // 计算当前时辰已过的刻数（初/正制：每个时辰分为初和正，各4刻）
    function getKe(shichenName, minutes) {
        const halfHour = 60; // 每个时辰分为初/正各60分钟
        const isFirstHalf = minutes < halfHour;
        const periodName = isFirstHalf ? '初' : '正';
        const minutesInPeriod = isFirstHalf ? minutes : (minutes - halfHour);
        const ke = Math.floor(minutesInPeriod / 15);
        const keNames = ['初', '一', '二', '三'];
        return `${shichenName}${periodName}${keNames[ke]}`;
    }

    // 初始化刻数标签
    function initKeLabels() {
        const container = document.getElementById('progressKeLabels');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const span = document.createElement('span');
            span.className = 'ke-label';
            span.dataset.index = i;
            span.textContent = i < 4 ? '初初' : '正初'; // 初始占位，后续动态更新
            container.appendChild(span);
        }
    }

    // 更新刻数标签文本（根据当前时辰）
    function updateKeLabels(shichenName) {
        const keNames = [
            `${shichenName}初•初刻`, `${shichenName}初•一刻`, `${shichenName}初•二刻`, `${shichenName}初•三刻`,
            `${shichenName}正•初刻`, `${shichenName}正•一刻`, `${shichenName}正•二刻`, `${shichenName}正•三刻`
        ];
        document.querySelectorAll('.ke-label').forEach((el, i) => {
            if (keNames[i]) {
                el.textContent = keNames[i];
            }
        });
    }

    let lastShichenIndex = -1;
    function updateShichenDisplay(date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        
        const shichenIndex = getCurrentShichenIndex(hours);
        const currentShichen = shichenList[shichenIndex];
        
        // 计算在当前时辰内的进度
        let secondsFromStart;
        if (currentShichen.start > currentShichen.end) {
            // 跨夜时辰（子时 23:00-01:00）
            if (hours >= currentShichen.start) {
                secondsFromStart = (hours - currentShichen.start) * 3600 + minutes * 60 + seconds;
            } else {
                secondsFromStart = (24 - currentShichen.start + hours) * 3600 + minutes * 60 + seconds;
            }
        } else {
            secondsFromStart = (hours - currentShichen.start) * 3600 + minutes * 60 + seconds;
        }
        
        const totalShichenSeconds = 2 * 3600;
        const progress = Math.min(Math.max(secondsFromStart / totalShichenSeconds, 0), 1);
        const progressPercent = (progress * 100).toFixed(2);
        
        // 时辰变化时，更新刻数标签和对照表
        if (shichenIndex !== lastShichenIndex) {
            lastShichenIndex = shichenIndex;
            initKeLabels();
            updateKeLabels(currentShichen.name);
            if (updateShichenReference) {
                updateShichenReference(shichenIndex);
            }
        }
        
        // 更新进度条
        const progressFill = document.getElementById('progressFill');
        const progressThumb = document.getElementById('progressThumb');
        if (progressFill) {
            progressFill.style.width = `${progressPercent}%`;
        }
        if (progressThumb) {
            progressThumb.style.left = `${progressPercent}%`;
        }
        
        // 更新刻数标签高亮（初/正制）
        const totalMinutes = secondsFromStart / 60;
        const currentKe = Math.min(Math.floor(totalMinutes / 15), 7);
        document.querySelectorAll('.ke-label').forEach((el, i) => {
            el.classList.toggle('active', i === currentKe);
        });
        
        // 更新时辰名称和时间范围
        const shichenNameElem = document.getElementById('progressShichenName');
        const shichenDetailElem = document.getElementById('progressShichenDetail');
        if (shichenNameElem) {
            shichenNameElem.textContent = `${currentShichen.emoji} ${currentShichen.name}时`;
        }
        if (shichenDetailElem) {
            shichenDetailElem.textContent = `${formatHour(currentShichen.start)} - ${formatHour(currentShichen.end)}`;
        }
        
        // 更新已经时间和百分比（显示在时辰标签右侧）
        const elapsedElem = document.getElementById('progressElapsed');
        const percentElem = document.getElementById('progressPercent');
        if (elapsedElem) {
            const elapsed = Math.floor(secondsFromStart);
            const elapsedMin = Math.floor(elapsed / 60);
            const elapsedSec = elapsed % 60;
            elapsedElem.textContent = `已进 ${elapsedMin}分${elapsedSec}秒`;
        }
        if (percentElem) {
            percentElem.textContent = `${progressPercent}%`;
        }
    }

    // 获取农历日期（通过API从服务器获取）
    let cachedLunar = {};
    let lastLunarDate = '';

    function fetchLunarFromServer(year, month, day, hour) {
        return fetch(`/api/lunar?year=${year}&month=${month}&day=${day}&hour=${hour}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    return { lunarStr: data.lunarStr, bazi: data.bazi };
                }
                return { lunarStr: '农历数据获取失败', bazi: null };
            })
            .catch(err => {
                console.error('农历API错误:', err);
                return { lunarStr: '农历数据获取失败', bazi: null };
            });
    }

    // 更新八字显示
    function updateBaziDisplay(bazi) {
        if (!bazi) return;
        const yearElem = document.getElementById('baziYear');
        const monthElem = document.getElementById('baziMonth');
        const dayElem = document.getElementById('baziDay');
        const timeElem = document.getElementById('baziTime');

        if (yearElem) yearElem.textContent = bazi.year;
        if (monthElem) monthElem.textContent = bazi.month;
        if (dayElem) dayElem.textContent = bazi.day;
        if (timeElem) timeElem.textContent = bazi.time;
    }

    // 八字解析
    function generateBaziAnalysis(bazi) {
        if (!bazi || !bazi.wuxing) return '';
        const wx = bazi.wuxing;
        const parts = [];

        // 统计
        const total = wx['金'] + wx['木'] + wx['水'] + wx['火'] + wx['土'];
        const maxWx = Object.entries(wx).sort((a, b) => b[1] - a[1]);
        const minWx = Object.entries(wx).sort((a, b) => a[1] - b[1]);

        // 最旺/最弱
        if (maxWx[0][1] >= 3) {
            parts.push(`${maxWx[0][0]}较旺`);
        }
        if (minWx[0][1] === 0) {
            parts.push(`缺${minWx[0][0]}`);
        } else if (minWx[0][1] === 1) {
            parts.push(`${minWx[0][0]}偏弱`);
        }

        // 五行齐全
        const allPresent = Object.values(wx).every(v => v > 0);
        if (allPresent) {
            parts.push('五行齐全');
        }

        if (parts.length === 0) return '';

        return `<div class="analysis-title">📊 五行简析</div>
                <div class="analysis-content">
                    ${parts.join('，')}。
                    <span class="disclaimer">⚠️ 仅供娱乐参考，不具备科学依据。</span>
                </div>`;
    }

    // 节气显示
    let cachedJieqi = null;
    async function updateJieqiDisplay(date) {
        const jieqiElem = document.getElementById('jieqiDisplay');
        if (!jieqiElem) return;

        const todayStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        if (cachedJieqi && cachedJieqi.date === todayStr) {
            if (cachedJieqi.name) {
                jieqiElem.textContent = cachedJieqi.name;
                jieqiElem.style.display = 'inline-block';
            } else {
                jieqiElem.style.display = 'none';
            }
            return;
        }

        try {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const resp = await fetch(`/api/lunar?year=${year}&month=${month}&day=${day}&hour=${date.getHours()}`);
            const data = await resp.json();
            
            if (data.success && data.jieqi) {
                cachedJieqi = { date: todayStr, name: data.jieqi };
                jieqiElem.textContent = data.jieqi;
                jieqiElem.style.display = 'inline-block';
            } else {
                cachedJieqi = { date: todayStr, name: null };
                jieqiElem.style.display = 'none';
            }
        } catch (err) {
            jieqiElem.style.display = 'none';
        }
    }

    // 更新农历显示（异步，仅在日期变化时请求）
    async function updateLunarDisplay(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours();
        const cacheKey = `${year}-${month}-${day}-${hour}`;
        const dateKey = `${year}-${month}-${day}`;

        if (cachedLunar[cacheKey]) {
            const lunarElem = document.getElementById('lunarDisplay');
            if (lunarElem) lunarElem.innerHTML = cachedLunar[cacheKey].lunarStr;
            updateBaziDisplay(cachedLunar[cacheKey].bazi);
            return;
        }

        // 如果日期或时辰变化，请求新的农历
        if (lastLunarDate !== dateKey) {
            lastLunarDate = dateKey;
            const result = await fetchLunarFromServer(year, month, day, hour);
            cachedLunar[cacheKey] = result;
            const lunarElem = document.getElementById('lunarDisplay');
            if (lunarElem) lunarElem.innerHTML = result.lunarStr;
            updateBaziDisplay(result.bazi);
        }
    }

    // 格式化时间 HH:MM:SS
    function formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function getMilliseconds(date) {
        return date.getMilliseconds().toString().padStart(3, '0');
    }

    let animationId = null;
    let lastDateStr = '';
    let lastTimeStr = '';

    function updateClock() {
        const now = getCurrentAccurateTime();
        const dateStr = formatDate(now);
        const timeStr = formatTime(now);
        const msStr = getMilliseconds(now);

        const dateElem = document.getElementById('dateDisplay');
        const timeElem = document.getElementById('timeDisplay');
        const msElem = document.getElementById('msDisplay');

        if (dateElem && dateStr !== lastDateStr) {
            dateElem.innerText = dateStr;
            lastDateStr = dateStr;
            // 日期变化时更新农历
            updateLunarDisplay(now);
            // 同时更新时区显示
            updateTimezoneDisplay();
        }
        // 更新时辰显示
        updateShichenDisplay(now);
        if (timeElem && timeStr !== lastTimeStr) {
            timeElem.innerText = timeStr;
            lastTimeStr = timeStr;
        }
        if (msElem) {
            msElem.innerText = `.${msStr}`;
        }

        animationId = requestAnimationFrame(updateClock);
    }

    // 八字计算弹窗
    let baziSelectedType = 'solar';
    let baziResultCache = {};
    let baziLastResult = null;

    function initBaziModal() {
        const overlay = document.getElementById('baziModalOverlay');
        const calcBtn = document.getElementById('baziCalcBtn');
        const closeBtn = document.getElementById('baziModalClose');
        const submitBtn = document.getElementById('baziCalcSubmit');
        const resetBtn = document.getElementById('baziCalcReset');
        const copyBtn = document.getElementById('baziCopyBtn');
        const nowBtn = document.getElementById('baziNowBtn');
        const stepInput = document.getElementById('baziStepInput');
        const stepResult = document.getElementById('baziStepResult');
        const previewEl = document.getElementById('baziInputPreview');
        const errorEl = document.getElementById('baziInputError');
        const resultErrorEl = document.getElementById('baziResultError');

        if (!overlay || !calcBtn) return;

        const shichenNames = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

        function showStep(step) {
            [stepInput, stepResult].forEach(s => s.classList.remove('show'));
            step.classList.add('show');
            hideErrors();
        }

        function hideErrors() {
            if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('show'); }
            if (resultErrorEl) { resultErrorEl.textContent = ''; resultErrorEl.classList.remove('show'); }
        }

        function showError(el, msg) {
            el.textContent = msg;
            el.classList.add('show');
        }

        function updatePreview() {
            const y = document.getElementById('baziInputYear').value;
            const m = document.getElementById('baziInputMonth').value;
            const d = document.getElementById('baziInputDay').value;
            const scIdx = parseInt(document.getElementById('baziInputShichen').value);
            const typeLabel = baziSelectedType === 'solar' ? '公历' : '农历';
            previewEl.textContent = `${typeLabel}：${y}年${m}月${d}日 ${shichenNames[scIdx]}`;
        }

        // 打开弹窗
        calcBtn.addEventListener('click', () => {
            overlay.classList.add('show');
            showStep(stepInput);
            updatePreview();
        });

        function closeModal() {
            overlay.classList.remove('show');
        }

        closeBtn.addEventListener('click', closeModal);

        // 单选切换
        document.querySelectorAll('.type-label').forEach(radio => {
            radio.addEventListener('click', () => {
                document.querySelectorAll('.type-label').forEach(r => r.classList.remove('active'));
                radio.classList.add('active');
                radio.querySelector('input').checked = true;
                baziSelectedType = radio.dataset.type;
                updatePreview();
            });
        });

        // 输入变化
        ['baziInputYear', 'baziInputMonth', 'baziInputDay', 'baziInputShichen'].forEach(id => {
            document.getElementById(id).addEventListener('input', updatePreview);
        });

        // 此刻按钮
        nowBtn.addEventListener('click', async () => {
            const now = getCurrentAccurateTime();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            const shichenIdx = Math.floor(((now.getHours() + 1) % 24) / 2);

            document.getElementById('baziInputShichen').value = shichenIdx;

            if (baziSelectedType === 'lunar') {
                try {
                    const resp = await fetch(`/api/lunar?year=${year}&month=${month}&day=${day}&hour=${now.getHours()}`);
                    const data = await resp.json();
                    if (data.success && data.bazi) {
                        document.getElementById('baziInputYear').value = data.bazi.lunarYear;
                        document.getElementById('baziInputMonth').value = data.bazi.lunarMonth;
                        document.getElementById('baziInputDay').value = data.bazi.lunarDay;
                        updatePreview();
                        hideErrors();
                        return;
                    }
                } catch (err) {
                    console.error('获取农历日期失败:', err);
                }
            }

            document.getElementById('baziInputYear').value = year;
            document.getElementById('baziInputMonth').value = month;
            document.getElementById('baziInputDay').value = day;
            updatePreview();
            hideErrors();
        });

        // 带超时的 fetch
        async function fetchWithTimeout(url, timeout = 8000) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(id);
                return response;
            } catch (err) {
                clearTimeout(id);
                throw err;
            }
        }

        // 提交计算
        submitBtn.addEventListener('click', async () => {
            hideErrors();
            const year = parseInt(document.getElementById('baziInputYear').value);
            const month = parseInt(document.getElementById('baziInputMonth').value);
            const day = parseInt(document.getElementById('baziInputDay').value);
            const shichenIdx = parseInt(document.getElementById('baziInputShichen').value);
            const hour = shichenIdx * 2 + 1;

            if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(shichenIdx)) {
                showError(errorEl, '请填写完整信息');
                return;
            }
            if (year < 1900 || year > 2100) {
                showError(errorEl, '年份范围为 1900-2100 年');
                return;
            }

            const cacheKey = `${baziSelectedType}-${year}-${month}-${day}-${shichenIdx}`;
            if (baziResultCache[cacheKey]) {
                displayBaziResult(baziResultCache[cacheKey], year, month, day, shichenIdx);
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '计算中...';

            try {
                let solarYear = year, solarMonth = month, solarDay = day;

                if (baziSelectedType === 'lunar') {
                    try {
                        const resp = await fetchWithTimeout(`/api/lunar-to-solar?year=${year}&month=${month}&day=${day}`);
                        const data = await resp.json();
                        if (data.success) {
                            solarYear = data.solarYear;
                            solarMonth = data.solarMonth;
                            solarDay = data.solarDay;
                        } else {
                            showError(errorEl, data.error || '农历日期不存在');
                            submitBtn.disabled = false;
                            submitBtn.textContent = '开始计算';
                            return;
                        }
                    } catch (err) {
                        showError(errorEl, err.name === 'AbortError' ? '请求超时，请重试' : '网络错误');
                        submitBtn.disabled = false;
                        submitBtn.textContent = '开始计算';
                        return;
                    }
                }

                try {
                    const resp = await fetchWithTimeout(`/api/lunar?year=${solarYear}&month=${solarMonth}&day=${solarDay}&hour=${hour}`);
                    const data = await resp.json();
                    if (data.success && data.bazi) {
                        // 附加转换后的公历信息（如果是从农历模式来的）
                        if (baziSelectedType === 'lunar') {
                            data.convertedSolar = { year: solarYear, month: solarMonth, day: solarDay };
                        }
                        baziResultCache[cacheKey] = data;
                        displayBaziResult(data, year, month, day, shichenIdx);
                    } else {
                        showError(errorEl, data.error || '八字计算失败');
                    }
                } catch (err) {
                    showError(errorEl, err.name === 'AbortError' ? '请求超时，请重试' : '网络错误');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '开始计算';
            }
        });

        // 显示结果
        function displayBaziResult(data, year, month, day, shichenIdx) {
            const bazi = data.bazi;
            if (!bazi) return;
            baziLastResult = bazi;

            // 移除加载状态
            document.querySelectorAll('.result-pillar').forEach(el => {
                el.classList.remove('loading');
            });

            document.getElementById('baziResultYear').textContent = bazi.year;
            document.getElementById('baziResultMonth').textContent = bazi.month;
            document.getElementById('baziResultDay').textContent = bazi.day;
            document.getElementById('baziResultTime').textContent = bazi.time;

            if (bazi.zodiac) {
                document.getElementById('baziResultZodiac').textContent = `生肖：${bazi.zodiac}`;
            }

            const wuxingEl = document.getElementById('baziResultWuxing');
            if (bazi.wuxing) {
                let wxHtml = '';
                const wxEmojis = { '金': '⚔️', '木': '🌿', '水': '💧', '火': '🔥', '土': '🏔️' };
                ['金', '木', '水', '火', '土'].forEach(wx => {
                    const count = bazi.wuxing[wx] || 0;
                    wxHtml += `<span class="wx-item" data-wx="${wx}"><span class="wx-name">${wxEmojis[wx]}${wx}</span><span class="wx-count">×${count}</span></span>`;
                });
                wuxingEl.innerHTML = wxHtml;
            }

            // 八字解析
            const analysisEl = document.getElementById('baziResultAnalysis');
            const analysisHtml = generateBaziAnalysis(bazi);
            if (analysisHtml) {
                analysisEl.innerHTML = analysisHtml;
                analysisEl.style.display = 'block';
            } else {
                analysisEl.style.display = 'none';
            }

            // 更新结果信息行：公历/农历对照显示
            const timeStr = shichenNames[shichenIdx];
            const infoEl = document.getElementById('baziResultInfo');
            
            if (baziSelectedType === 'solar') {
                const lunarStr = data.lunarStr || '';
                infoEl.innerHTML = `
                    <div class="info-main">公历：${year}年${month}月${day}日 ${timeStr}</div>
                    <div class="info-sub">农历：${lunarStr}</div>
                `;
            } else {
                const solar = data.convertedSolar;
                const solarStr = solar ? `${solar.year}年${solar.month}月${solar.day}日` : '';
                infoEl.innerHTML = `
                    <div class="info-main">农历：${year}年${month}月${day}日 ${timeStr}</div>
                    <div class="info-sub">公历：${solarStr}</div>
                `;
            }

            showStep(stepResult);
        }

        // 复制八字
        copyBtn.addEventListener('click', () => {
            if (!baziLastResult) return;
            const b = baziLastResult;
            const text = `八字：${b.year} ${b.month} ${b.day} ${b.time}\n生肖：${b.zodiac || '--'}`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.textContent = '✓ 已复制';
                    setTimeout(() => { copyBtn.textContent = '📋 复制八字'; }, 1500);
                });
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyBtn.textContent = '✓ 已复制';
                setTimeout(() => { copyBtn.textContent = '📋 复制八字'; }, 1500);
            }
        });

        resetBtn.addEventListener('click', () => {
            showStep(stepInput);
            updatePreview();
        });
    }

    // 全局错误边界
    let isNetworkOffline = false;
    window.addEventListener('error', (e) => {
        if (e.message && e.message.includes('fetch')) {
            console.warn('网络请求失败:', e.message);
        }
    });

    window.addEventListener('online', () => {
        isNetworkOffline = false;
        console.log('🌐 网络已恢复');
    });

    window.addEventListener('offline', () => {
        isNetworkOffline = true;
        console.warn('⚠️ 网络已断开，将使用本地时间');
    });

    // 初次启动
    updateTimezoneDisplay();
    initKeLabels();
    initBaziModal();
    fetchServerTime().then(() => {
        const initialDate = getCurrentAccurateTime();
        updateLunarDisplay(initialDate);
        updateJieqiDisplay(initialDate);
        updateShichenDisplay(initialDate);
        updateClock();
    }).catch(() => {
        offset = 0;
        const initialDate = getCurrentAccurateTime();
        updateLunarDisplay(initialDate);
        updateShichenDisplay(initialDate);
        updateClock();
    });

    window.addEventListener('beforeunload', () => {
        if(animationId) cancelAnimationFrame(animationId);
    });
})();
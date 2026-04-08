(function() {
    // 从服务器获取基准UTC时间 (毫秒级时间戳 + 传输耗时校准)
    let utcBaseTime = null;
    let clientFetchTime = null;
    let offset = 0;

    // 获取精准UTC时间
    function fetchServerTime() {
        const requestStart = performance.now();
        return fetch('/api/time')
            .then(response => response.json())
            .then(data => {
                const requestEnd = performance.now();
                const serverTimeRecv = data.utcTimeMs;
                const rtt = requestEnd - requestStart;
                const estimatedServerTimeAtReceive = serverTimeRecv + (rtt / 2);
                const localNow = performance.now();
                offset = estimatedServerTimeAtReceive - localNow;
                utcBaseTime = data.utcTimeMs;
                clientFetchTime = Date.now();
                console.log(`时间同步完成 | 偏移: ${offset.toFixed(2)}ms | RTT: ${rtt.toFixed(2)}ms`);
                return true;
            })
            .catch(err => {
                console.error("同步失败，使用本地时间偏移:", err);
                offset = 0;
                return false;
            });
    }

    // 获取当前的真实UTC时间，并转换为本地时区Date对象
    function getCurrentAccurateTime() {
        const nowLocal = performance.now();
        let realTimestamp;
        if (offset !== null && !isNaN(offset)) {
            realTimestamp = nowLocal + offset;
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

    // 更新时辰显示（单条数轴样式）
    // 十二时辰：子(23-1), 丑(1-3), 寅(3-5), 卯(5-7), 辰(7-9), 巳(9-11), 午(11-13), 未(13-15), 申(15-17), 酉(17-19), 戌(19-21), 亥(21-23)
    const shichenList = [
        { name: '子', start: 23, emoji: '🌙' },
        { name: '丑', start: 1, emoji: '🐂' },
        { name: '寅', start: 3, emoji: '🐅' },
        { name: '卯', start: 5, emoji: '🐇' },
        { name: '辰', start: 7, emoji: '🐉' },
        { name: '巳', start: 9, emoji: '🐍' },
        { name: '午', start: 11, emoji: '☀️' },
        { name: '未', start: 13, emoji: '🐑' },
        { name: '申', start: 15, emoji: '🐒' },
        { name: '酉', start: 17, emoji: '🐓' },
        { name: '戌', start: 19, emoji: '🐕' },
        { name: '亥', start: 21, emoji: '🐖' }
    ];

    // 初始化时辰名称和时间标记
    function initTimelineUI() {
        const namesContainer = document.getElementById('timelineNames');
        const timeLabelsContainer = document.getElementById('timelineTimeLabels');
        
        if (!namesContainer || !timeLabelsContainer) return;
        
        // 生成12个时辰名称
        shichenList.forEach((sc, i) => {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'timeline-name';
            nameSpan.id = `timeline-name-${i}`;
            nameSpan.textContent = `${sc.emoji} ${sc.name}`;
            namesContainer.appendChild(nameSpan);
            
            // 生成时间标记（每个时辰起点）
            if (i < 12) {
                const timeLabel = document.createElement('span');
                timeLabel.className = 'timeline-time-label';
                const hour = sc.start.toString().padStart(2, '0');
                timeLabel.textContent = `${hour}:00`;
                timeLabelsContainer.appendChild(timeLabel);
            }
        });
        
        // 最后添加一个结束时间标记（23:00）
        const endTimeLabel = document.createElement('span');
        endTimeLabel.className = 'timeline-time-label';
        endTimeLabel.textContent = '23:00';
        timeLabelsContainer.appendChild(endTimeLabel);
    }

    function getCurrentShichenIndex(hours) {
        // 根据小时计算当前时辰索引（0-11）
        for (let i = 0; i < shichenList.length; i++) {
            const current = shichenList[i];
            const next = shichenList[(i + 1) % 12];
            
            if (current.start < next.start) {
                // 正常时段（如丑时 1:00-3:00）
                if (hours >= current.start && hours < next.start) {
                    return i;
                }
            } else {
                // 跨夜时段（子时 23:00-1:00）
                if (hours >= current.start || hours < next.start) {
                    return i;
                }
            }
        }
        return 0; // 默认子时
    }

    let lastShichenKey = '';
    function updateShichenDisplay(date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        
        const shichenIndex = getCurrentShichenIndex(hours);
        const currentShichen = shichenList[shichenIndex];
        const nextShichen = shichenList[(shichenIndex + 1) % 12];
        
        // 计算在当前时辰内的进度（0-1之间）
        let secondsFromStart;
        if (currentShichen.start > nextShichen.start) {
            // 跨夜时辰（子时 23:00-01:00）
            if (hours >= currentShichen.start) {
                secondsFromStart = (hours - currentShichen.start) * 3600 + minutes * 60 + seconds;
            } else {
                secondsFromStart = (24 - currentShichen.start + hours) * 3600 + minutes * 60 + seconds;
            }
        } else {
            secondsFromStart = (hours - currentShichen.start) * 3600 + minutes * 60 + seconds;
        }
        
        const totalShichenSeconds = 2 * 3600; // 每个时辰2小时
        const progressInShichen = secondsFromStart / totalShichenSeconds;
        
        // 计算在整个数轴上的位置 (0-1之间)
        // 数轴从子时(索引0)开始，到亥时结束
        const totalProgress = (shichenIndex + progressInShichen) / 12;
        const position = Math.min(Math.max(totalProgress * 100, 0), 99.5);
        
        // 生成唯一键用于检测变化
        const shichenKey = `${shichenIndex}_${Math.floor(progressInShichen * 100)}`;
        
        if (shichenKey !== lastShichenKey) {
            lastShichenKey = shichenKey;
            
            const dot = document.getElementById('timelineDot');
            if (dot) {
                dot.style.left = `${position}%`;
                dot.title = `${currentShichen.emoji} ${currentShichen.name}时`;
            }
            
            // 更新时辰名称高亮
            document.querySelectorAll('.timeline-name').forEach((el, i) => {
                el.classList.toggle('active', i === shichenIndex);
            });
        }
    }

    // 初始化
    initTimelineUI();

    // 获取农历日期（通过API从服务器获取）
    let cachedLunar = {};
    let lastLunarDate = '';
    
    function fetchLunarFromServer(year, month, day) {
        return fetch(`/api/lunar?year=${year}&month=${month}&day=${day}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    return data.lunarStr;
                }
                return '农历数据获取失败';
            })
            .catch(err => {
                console.error('农历API错误:', err);
                return '🪭 加载失败';
            });
    }

    // 更新农历显示（异步，仅在日期变化时请求）
    async function updateLunarDisplay(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const cacheKey = `${year}-${month}-${day}`;
        
        if (cachedLunar[cacheKey]) {
            const lunarElem = document.getElementById('lunarDisplay');
            if (lunarElem) lunarElem.innerHTML = `🪭 ${cachedLunar[cacheKey]}`;
            return;
        }
        
        // 如果日期变化，请求新的农历
        if (lastLunarDate !== cacheKey) {
            lastLunarDate = cacheKey;
            const lunarStr = await fetchLunarFromServer(year, month, day);
            cachedLunar[cacheKey] = lunarStr;
            const lunarElem = document.getElementById('lunarDisplay');
            if (lunarElem) lunarElem.innerHTML = `🪭 ${lunarStr}`;
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
            const nowDisplay = getCurrentAccurateTime();
            document.getElementById('dateDisplay').innerText = formatDate(nowDisplay);
            document.getElementById('timeDisplay').innerText = formatTime(nowDisplay);
            document.getElementById('msDisplay').innerText = '.' + getMilliseconds(nowDisplay);
            updateLunarDisplay(nowDisplay);
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

    // 初次启动
    updateTimezoneDisplay();
    fetchServerTime().then(() => {
        const initialDate = getCurrentAccurateTime();
        updateLunarDisplay(initialDate);
        updateShichenDisplay(initialDate);
        updateClock();
    }).catch(() => {
        offset = 0;
        const initialDate = getCurrentAccurateTime();
        updateLunarDisplay(initialDate);
        updateShichenDisplay(initialDate);
        updateClock();
    });

    const syncButton = document.getElementById('syncBtn');
    if (syncButton) {
        syncButton.addEventListener('click', resync);
    }

    window.addEventListener('beforeunload', () => {
        if(animationId) cancelAnimationFrame(animationId);
    });
})();
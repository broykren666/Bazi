(function() {
    // 从服务器获取基准时间 (毫秒级时间戳 + 传输耗时校准)
    let serverBaseTime = null;
    let clientFetchTime = null;
    let offset = 0;

    // 获取精准服务器时间
    function fetchServerTime() {
        const requestStart = performance.now();
        return fetch('/api/time')
            .then(response => response.json())
            .then(data => {
                const requestEnd = performance.now();
                const serverTimeRecv = data.serverTimeMs;
                const rtt = requestEnd - requestStart;
                const estimatedServerTimeAtReceive = serverTimeRecv + (rtt / 2);
                const localNow = performance.now();
                offset = estimatedServerTimeAtReceive - localNow;
                serverBaseTime = data.serverTimeMs;
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

    // 获取当前的真实时间
    function getCurrentAccurateTime() {
        const nowLocal = performance.now();
        let realTimestamp;
        if (offset !== null && !isNaN(offset)) {
            realTimestamp = nowLocal + offset;
        } else {
            realTimestamp = Date.now();
        }
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
                return '🌙 加载失败';
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
            if (lunarElem) lunarElem.innerHTML = `🌙 ${cachedLunar[cacheKey]}`;
            return;
        }
        
        // 如果日期变化，请求新的农历
        if (lastLunarDate !== cacheKey) {
            lastLunarDate = cacheKey;
            const lunarStr = await fetchLunarFromServer(year, month, day);
            cachedLunar[cacheKey] = lunarStr;
            const lunarElem = document.getElementById('lunarDisplay');
            if (lunarElem) lunarElem.innerHTML = `🌙 ${lunarStr}`;
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
        }
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
    fetchServerTime().then(() => {
        const initialDate = getCurrentAccurateTime();
        updateLunarDisplay(initialDate);
        updateClock();
    }).catch(() => {
        offset = 0;
        const initialDate = getCurrentAccurateTime();
        updateLunarDisplay(initialDate);
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
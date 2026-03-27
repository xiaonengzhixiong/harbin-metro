// ==================== 配置 ====================
const bounds = {
    minLng: 126.53,
    maxLng: 126.75,
    minLat: 45.60,
    maxLat: 45.88
};

const lineColors = {
    '1号线': '#C8102E',
    '2号线': '#00AB59',
    '3号线': '#FFC72C'
};

const geoWidth = bounds.maxLng - bounds.minLng;
const geoHeight = bounds.maxLat - bounds.minLat;
const geoAspect = geoWidth / geoHeight;
const canvasWidth = 585;
const canvasHeight = canvasWidth / geoAspect;

// 全局变量
let stations = [];
let lines = [];
let ctx;
let offsetX = 0, offsetY = 0;
let scale = 1;
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// 动画相关
let animationId = null;
let simTime = 19800;      // 5:30 开始
let isPlaying = true;
let speed = 30;           // 默认 30 倍速

// 列车数据
let trains = [];
let currentTrains = [];

// Tooltip 相关
let tooltip = null;

// ==================== 1号线数据 ====================
// 上行：新疆大街(s23) → 哈尔滨东站(s1)
const line1StationsUp = [
    "s23","s22","s21","s20","s19","s18","s17","s16","s15","s14",
    "s13","s12","s11","s10","s9","s8","s7","s6","s5","s4","s3","s2","s1"
];
// 下行：哈尔滨东站(s1) → 新疆大街(s23)
const line1StationsDown = [
    "s1","s2","s3","s4","s5","s6","s7","s8","s9","s10",
    "s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23"
];
// 区间运行时间（秒）
const segmentTimes1Up = [
    180, 120, 180, 120, 120, 180, 120, 120, 120, 120,
    120, 120, 120, 120, 120, 120, 60, 120, 120, 120, 120, 60
];
const segmentTimes1Down = [
    60, 180, 120, 120, 120, 120, 60, 120, 120, 120,
    120, 120, 120, 120, 120, 120, 180, 120, 120, 180, 120, 180
];

// ==================== 2号线数据 ====================
// 下行：气象台(s24) → 江北大学城(s42)
const line2StationsDown = [
    "s24","s25","s26","s27","s28","s29","s30","s31","s32","s33",
    "s34","s35","s36","s37","s38","s39","s40","s41","s42"
];
// 上行：江北大学城(s42) → 气象台(s24)
const line2StationsUp = [
    "s42","s41","s40","s39","s38","s37","s36","s35","s34","s33",
    "s32","s31","s30","s29","s28","s27","s26","s25","s24"
];
// 区间运行时间（秒），下行方向（s24→s42）
const segmentTimes2Down = [
    120, 240, 120, 120, 120, 120, 120, 120, 120, 120,
    120, 240, 180, 240, 180, 120, 240, 180
];
// 上行方向（s42→s24）为反向时间
const segmentTimes2Up = [...segmentTimes2Down].reverse();

// ==================== 通用参数 ====================
const firstTrainTime = 5.5 * 3600;   // 5:30
const lastTrainTime = 22.5 * 3600;    // 22:30

const peakHours = [
    { start: 7*3600, end: 9*3600 },
    { start: 17*3600, end: 19*3600 }
];

function isPeakHour(t) {
    return peakHours.some(p => t >= p.start && t <= p.end);
}

function getHeadway(t) {
    return isPeakHour(t) ? 300 : 420;
}

// 生成某方向的所有列车
function generateTrainsForDirection(startStationId, endStationId, stationIds, segmentDurations, isUp, lineName, startIdOffset) {
    const trainsList = [];
    const cumTimes = [0];
    for (let i = 0; i < segmentDurations.length; i++) {
        cumTimes.push(cumTimes[i] + segmentDurations[i]);
    }
    const totalTravelTime = cumTimes[cumTimes.length - 1];

    let currentTime = firstTrainTime;
    let trainId = startIdOffset;
    while (currentTime <= lastTrainTime) {
        const stationTimes = {};
        stationIds.forEach((sid, idx) => {
            stationTimes[sid] = currentTime + cumTimes[idx];
        });
        trainsList.push({
            id: trainId,
            direction: isUp ? '上行' : '下行',
            line: lineName,
            startStation: startStationId,
            endStation: endStationId,
            startTime: currentTime,
            endTime: currentTime + totalTravelTime,
            stationTimes: stationTimes,
            stationIds: stationIds,
            segmentDurations: segmentDurations
        });
        trainId += 1;
        const interval = getHeadway(currentTime);
        currentTime += interval;
        if (currentTime > lastTrainTime + 3600) break;
    }
    return trainsList;
}

// 生成所有列车
function generateAllTrains() {
    const trainsList = [];

    // 1号线
    const upTrains1 = generateTrainsForDirection('s23', 's1', line1StationsUp, segmentTimes1Up, true, '1号线', 1);
    const downTrains1 = generateTrainsForDirection('s1', 's23', line1StationsDown, segmentTimes1Down, false, '1号线', 1000);
    trainsList.push(...upTrains1, ...downTrains1);

    // 2号线
    const upTrains2 = generateTrainsForDirection('s42', 's24', line2StationsUp, segmentTimes2Up, true, '2号线', 2000);
    const downTrains2 = generateTrainsForDirection('s24', 's42', line2StationsDown, segmentTimes2Down, false, '2号线', 3000);
    trainsList.push(...upTrains2, ...downTrains2);

    return trainsList;
}

// ==================== 辅助函数 ====================
function lngLatToXY(lng, lat) {
    const xRatio = (lng - bounds.minLng) / geoWidth;
    const yRatio = (lat - bounds.minLat) / geoHeight;
    const x = xRatio * canvasWidth;
    const y = canvasHeight - (yRatio * canvasHeight);
    return { x, y };
}

function getStationColor(lineName) {
    return lineColors[lineName] || '#999';
}

function updateCurrentTrains(now) {
    currentTrains = [];
    // 用于统计各线路数量
    let countLine1 = 0;
    let countLine2 = 0;
    let countLine3 = 0;

    trains.forEach(train => {
        if (now >= train.startTime && now <= train.endTime) {
            // 统计线路
            if (train.line === '1号线') countLine1++;
            else if (train.line === '2号线') countLine2++;
            else if (train.line === '3号线') countLine3++;

            // 原有计算列车位置逻辑...
            let currentSegmentIdx = -1;
            let segmentStartTime = train.startTime;
            for (let i = 0; i < train.stationIds.length - 1; i++) {
                const stationId = train.stationIds[i];
                const nextStationId = train.stationIds[i+1];
                const arrivalThis = train.stationTimes[stationId];
                const arrivalNext = train.stationTimes[nextStationId];
                if (now >= arrivalThis && now <= arrivalNext) {
                    currentSegmentIdx = i;
                    segmentStartTime = arrivalThis;
                    break;
                }
            }
            if (currentSegmentIdx === -1) return;

            const startStationId = train.stationIds[currentSegmentIdx];
            const endStationId = train.stationIds[currentSegmentIdx+1];
            const segmentDuration = train.segmentDurations[currentSegmentIdx];
            const elapsed = now - segmentStartTime;
            const ratio = elapsed / segmentDuration;
            const startStation = stations.find(s => s.id === startStationId);
            const endStation = stations.find(s => s.id === endStationId);
            if (!startStation || !endStation) return;
            const startPos = lngLatToXY(startStation.x, startStation.y);
            const endPos = lngLatToXY(endStation.x, endStation.y);
            const x = startPos.x + (endPos.x - startPos.x) * ratio;
            const y = startPos.y + (endPos.y - startPos.y) * ratio;
            currentTrains.push({
                trainId: train.id,
                direction: train.direction,
                line: train.line,
                x: x,
                y: y,
                startStation: startStation.name,
                endStation: endStation.name,
                progress: ratio,
                currentSegment: `${startStation.name} → ${endStation.name}`
            });
        }
    });

    // 更新各线路计数器
    document.getElementById('trainCountLine1').textContent = countLine1;
    document.getElementById('trainCountLine2').textContent = countLine2;
    document.getElementById('trainCountLine3').textContent = countLine3;
    document.getElementById('totalTrainCount').textContent = currentTrains.length;
}

// ==================== 绘图 ====================
function draw() {
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. 画线路（使用 D3 CatmullRom 曲线）
    lines.forEach(line => {
        const points = line.stations
            .map(id => stations.find(s => s.id === id))
            .filter(s => s)
            .map(s => lngLatToXY(s.x, s.y));
        if (points.length < 2) return;

        const lineGenerator = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCatmullRom);
        const pathData = lineGenerator(points);
        if (!pathData) return;

        const path = new Path2D(pathData);
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 4 / scale;
        ctx.lineCap = 'round';
        ctx.stroke(path);
    });

    // 2. 画站点
    stations.forEach(station => {
        const { x, y } = lngLatToXY(station.x, station.y);
        ctx.beginPath();
        ctx.arc(x, y, 4 / scale, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = getStationColor(station.line);
        ctx.lineWidth = 2 / scale;
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = `${10 / scale}px "Microsoft YaHei"`;
        ctx.fillText(station.name, x + 6 / scale, y - 4 / scale);
    });

    // 3. 画列车（根据线路使用不同颜色）
    currentTrains.forEach(train => {
        ctx.beginPath();
        ctx.arc(train.x, train.y, 7 / scale, 0, 2 * Math.PI);
        // 不同线路的列车用不同颜色，便于区分
        if (train.line === '1号线') ctx.fillStyle = '#C8102E';
        else if (train.line === '2号线') ctx.fillStyle = '#00AB59';
        else ctx.fillStyle = '#FFC72C';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
    });

    ctx.restore();
}

// ==================== 缩放平移 ====================
function initCanvasInteraction(canvas) {
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoom = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(5, Math.max(0.5, scale * zoom));
        if (newScale !== scale) {
            const mouseWorldX = (mouseX - offsetX) / scale;
            const mouseWorldY = (mouseY - offsetY) / scale;
            scale = newScale;
            offsetX = mouseX - mouseWorldX * scale;
            offsetY = mouseY - mouseWorldY * scale;
            draw();
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            offsetX = e.clientX - dragStart.x;
            offsetY = e.clientY - dragStart.y;
            draw();
        }
        updateTooltip(e, canvas);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });
    canvas.style.cursor = 'grab';
}

function resetView() {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    offsetX = centerX - centerX * 0.8;
    offsetY = centerY - centerY * 0.8;
    scale = 0.9;
    draw();
}

// ==================== Tooltip ====================
function updateTooltip(e, canvas) {
    if (!tooltip) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (mouseX - offsetX) / scale;
    const canvasY = (mouseY - offsetY) / scale;

    let hitTrain = null;
    const threshold = 15 / scale;
    for (let train of currentTrains) {
        const dx = train.x - canvasX;
        const dy = train.y - canvasY;
        if (Math.sqrt(dx*dx + dy*dy) <= threshold) {
            hitTrain = train;
            break;
        }
    }

    if (hitTrain) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 10) + 'px';
        tooltip.style.top = (e.clientY - 20) + 'px';
        tooltip.innerHTML = `${hitTrain.direction} ${hitTrain.currentSegment}`;
    } else {
        tooltip.style.display = 'none';
    }
}

// ==================== 动画与时间控制 ====================
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimeDisplay() {
    const timeDisplay = document.getElementById('timeDisplay');
    if (timeDisplay) timeDisplay.textContent = formatTime(simTime);
    const slider = document.getElementById('timeSlider');
    if (slider) slider.value = simTime;
}

function setSimTime(value) {
    simTime = Math.min(86400, Math.max(0, value));
    updateTimeDisplay();
    updateCurrentTrains(simTime);
    draw();
}

let lastTimestamp = 0;
function animationLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    if (isPlaying) {
        simTime += delta * speed;
        if (simTime > lastTrainTime + 3600) simTime = firstTrainTime;
        updateTimeDisplay();
        updateCurrentTrains(simTime);
        draw();
    }
    animationId = requestAnimationFrame(animationLoop);
}

function startAnimation() {
    if (animationId) return;
    lastTimestamp = 0;
    animationId = requestAnimationFrame(animationLoop);
}

function togglePlayPause() {
    isPlaying = !isPlaying;
    const btn = document.getElementById('playPauseBtn');
    btn.textContent = isPlaying ? '⏸ 暂停' : '▶ 播放';
}

// ==================== 数据加载 ====================
async function loadData() {
    const stationsRes = await fetch('data/stations.json');
    const linesRes = await fetch('data/lines.json');
    const stationsData = await stationsRes.json();
    const linesData = await linesRes.json();
    stations = stationsData.stations;
    lines = linesData.lines;
    trains = generateAllTrains();
    updateCurrentTrains(simTime);
}

// ==================== 初始化 ====================
window.onload = async () => {
    const canvas = document.getElementById('metroCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    tooltip = document.getElementById('tooltip');

    await loadData();
    resetView();
    initCanvasInteraction(canvas);
    startAnimation();

    document.getElementById('playPauseBtn').onclick = togglePlayPause;

    const timeSlider = document.getElementById('timeSlider');
    timeSlider.oninput = (e) => {
        if (!isPlaying) setSimTime(parseInt(e.target.value));
    };

    // 速度档位
    const speedLevels = [1, 30, 50, 80, 150];
    const speedLabels = ['1x', '30x', '50x', '80x', '150x'];
    const speedSlider = document.getElementById('speedSlider');
    const speedDisplay = document.getElementById('speedDisplay');
    const defaultLevel = 1; // 30x
    speed = speedLevels[defaultLevel];
    speedSlider.value = defaultLevel;
    speedDisplay.textContent = speedLabels[defaultLevel];
    speedSlider.oninput = (e) => {
        const level = parseInt(e.target.value);
        speed = speedLevels[level];
        speedDisplay.textContent = speedLabels[level];
    };

    setSimTime(simTime);
};
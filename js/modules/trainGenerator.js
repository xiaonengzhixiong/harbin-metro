import { OPERATION, PEAK_HOURS } from '../config.js';
import {
  LINE1_STATIONS_UP, LINE1_STATIONS_DOWN, SEGMENT_TIMES_1_UP, SEGMENT_TIMES_1_DOWN,
  LINE2_STATIONS_UP, LINE2_STATIONS_DOWN, SEGMENT_TIMES_2_UP, SEGMENT_TIMES_2_DOWN,
  FULL_STATIONS_3, FULL_TIMES_3
} from '../utils/constants.js';

function isPeakHour(t) {
  return PEAK_HOURS.some(p => t >= p.start && t <= p.end);
}

// 1、2号线原有逻辑不变
function getHeadwayForLine12(lineName, t) {
  return isPeakHour(t) ? 240 : 420;
}

function generateTrainsForLine12(lineName, direction, stationIds, segmentTimes, startStationId, endStationId, startIdOffset) {
  const trains = [];
  const cumTimes = [0];
  for (let i = 0; i < segmentTimes.length; i++) {
    cumTimes.push(cumTimes[i] + segmentTimes[i]);
  }
  const totalTravelTime = cumTimes[cumTimes.length - 1];

  let currentTime = OPERATION.firstTrain;
  let trainId = startIdOffset;
  while (currentTime <= OPERATION.lastTrain) {
    const stationTimes = {};
    stationIds.forEach((sid, idx) => {
      stationTimes[sid] = currentTime + cumTimes[idx];
    });
    trains.push({
      id: trainId,
      line: lineName,
      direction: direction,
      startStation: startStationId,
      endStation: endStationId,
      startTime: currentTime,
      endTime: currentTime + totalTravelTime,
      stationTimes: stationTimes,
      stationIds: stationIds,
      segmentDurations: segmentTimes
    });
    trainId++;
    const interval = getHeadwayForLine12(lineName, currentTime);
    currentTime += interval;
    if (currentTime > OPERATION.lastTrain + 3600) break;
  }
  return trains;
}

// ========== 3号线专用逻辑 ==========
// 计算一圈的总时间（秒）
function getLoopTotalTime() {
  return FULL_TIMES_3.reduce((a, b) => a + b, 0);
}

// 构建顺时针站点序列（从 s57 开始完整一圈，首尾重复）
function buildInnerStationSequence() {
  const start = "s57";
  const startIdx = FULL_STATIONS_3.indexOf(start);
  const sequence = [];
  for (let i = 0; i < FULL_STATIONS_3.length; i++) {
    const idx = (startIdx + i) % (FULL_STATIONS_3.length - 1);
    sequence.push(FULL_STATIONS_3[idx]);
  }
  return sequence; // 长度37，首尾都是s57
}

// 构建逆时针站点序列（从 s56 开始完整一圈）
function buildOuterStationSequence() {
  const start = "s56";
  const startIdx = FULL_STATIONS_3.indexOf(start);
  const sequence = [];
  for (let i = 0; i < FULL_STATIONS_3.length; i++) {
    let idx = (startIdx - i) % (FULL_STATIONS_3.length - 1);
    if (idx < 0) idx += (FULL_STATIONS_3.length - 1);
    sequence.push(FULL_STATIONS_3[idx]);
  }
  return sequence; // 长度37，首尾都是s56
}

// 获取顺时针方向的时间数组（内环用）
function getInnerSegmentTimes() {
  // 内环直接用 FULL_TIMES_3 即可（因为内环序列与 FULL_STATIONS_3 顺序一致）
  return [...FULL_TIMES_3];
}

// 获取逆时针方向的时间数组（外环用）
function getOuterSegmentTimes() {
  // 外环时间等于顺时针时间数组的逆序
  return [...FULL_TIMES_3].reverse();
}

function generateLine3Trains(direction, stationSeq, segmentTimes, startId, startIdOffset) {
  const trains = [];
  const loopTime = segmentTimes.reduce((a, b) => a + b, 0);
  const cumTimes = [0];
  for (let i = 0; i < segmentTimes.length; i++) {
    cumTimes.push(cumTimes[i] + segmentTimes[i]);
  }

  const peakPeriods = [...PEAK_HOURS].sort((a, b) => a.start - b.start);
  const morningStart = peakPeriods[0].start;
  const morningEnd = peakPeriods[0].end;
  const eveningStart = peakPeriods[1].start;
  const eveningEnd = peakPeriods[1].end;

  const NORMAL_INTERVAL = 480; // 8分钟

  // 1. 基础列车：10列，从首班车开始按8分钟间隔发车，全天运行至运营结束
  const baseCount = 10;
  for (let i = 0; i < baseCount; i++) {
    const startTime = OPERATION.firstTrain + i * NORMAL_INTERVAL;
    if (startTime > OPERATION.lastTrain + loopTime) continue;
    const endTime = OPERATION.lastTrain + loopTime; // 运营结束后跑完一圈退库
    const firstLoopStationTimes = {};
    stationSeq.forEach((sid, idx) => {
      firstLoopStationTimes[sid] = startTime + cumTimes[idx];
    });
    trains.push({
      id: startIdOffset + i,
      line: "3号线",
      direction: direction,
      startStation: startId,
      endStation: startId,
      startTime: startTime,
      endTime: endTime,
      loopTime: loopTime,
      stationSeq: stationSeq,
      segmentTimes: segmentTimes,
      firstLoopStationTimes: firstLoopStationTimes,
      stationIds: stationSeq,
      segmentDurations: segmentTimes,
      stationTimes: firstLoopStationTimes,
    });
  }

  // 计算从出库点到回库点的运行时间（沿运行方向）
  const depotOut = startId;      // 内环 s57，外环 s56
  const depotIn = (startId === 's57') ? 's56' : 's57';
  const idxOut = stationSeq.indexOf(depotOut);
  const idxIn = stationSeq.indexOf(depotIn);
  let timeOutToIn = 0;
  if (idxIn > idxOut) {
    for (let i = idxOut; i < idxIn; i++) timeOutToIn += segmentTimes[i];
  } else {
    // 逆时针情况：从出库点出发到回库点需要经过末尾绕一圈
    for (let i = idxOut; i < stationSeq.length - 1; i++) timeOutToIn += segmentTimes[i];
    for (let i = 0; i < idxIn; i++) timeOutToIn += segmentTimes[i];
  }

  // 2. 生成加车时刻表（严格按照用户要求）
  // 早高峰加车：7:04, 7:12, ..., 8:08
  const morningExtraTimes = [];
  const firstMorningExtra = morningStart + 4 * 60; // 7:04
  for (let i = 0; i < 9; i++) {
    const t = firstMorningExtra + i * NORMAL_INTERVAL;
    if (t <= morningEnd) morningExtraTimes.push(t);
  }
  // 晚高峰加车：17:02, 17:10, ..., 18:06
  const eveningExtraTimes = [];
  const firstEveningExtra = eveningStart + 2 * 60; // 17:02
  for (let i = 0; i < 9; i++) {
    const t = firstEveningExtra + i * NORMAL_INTERVAL;
    if (t <= eveningEnd) eveningExtraTimes.push(t);
  }

  let extraId = startIdOffset + baseCount;

  // 处理早高峰加车
  for (let startTime of morningExtraTimes) {
    const firstArrivalAtDepotIn = startTime + timeOutToIn;
    let endTime;
    if (firstArrivalAtDepotIn > morningEnd) {
      endTime = firstArrivalAtDepotIn;
    } else {
      // 若在高峰结束前已经过回库点，则再跑一圈后到达回库点
      endTime = firstArrivalAtDepotIn + loopTime;
    }
    if (endTime <= startTime) continue;
    const firstLoopStationTimes = {};
    stationSeq.forEach((sid, idx) => {
      firstLoopStationTimes[sid] = startTime + cumTimes[idx];
    });
    trains.push({
      id: extraId++,
      line: "3号线",
      direction: direction,
      startStation: startId,
      endStation: startId,
      startTime: startTime,
      endTime: endTime,
      loopTime: loopTime,
      stationSeq: stationSeq,
      segmentTimes: segmentTimes,
      firstLoopStationTimes: firstLoopStationTimes,
      stationIds: stationSeq,
      segmentDurations: segmentTimes,
      stationTimes: firstLoopStationTimes,
    });
  }

  // 处理晚高峰加车
  for (let startTime of eveningExtraTimes) {
    const firstArrivalAtDepotIn = startTime + timeOutToIn;
    let endTime;
    if (firstArrivalAtDepotIn > eveningEnd) {
      endTime = firstArrivalAtDepotIn;
    } else {
      endTime = firstArrivalAtDepotIn + loopTime;
    }
    if (endTime <= startTime) continue;
    const firstLoopStationTimes = {};
    stationSeq.forEach((sid, idx) => {
      firstLoopStationTimes[sid] = startTime + cumTimes[idx];
    });
    trains.push({
      id: extraId++,
      line: "3号线",
      direction: direction,
      startStation: startId,
      endStation: startId,
      startTime: startTime,
      endTime: endTime,
      loopTime: loopTime,
      stationSeq: stationSeq,
      segmentTimes: segmentTimes,
      firstLoopStationTimes: firstLoopStationTimes,
      stationIds: stationSeq,
      segmentDurations: segmentTimes,
      stationTimes: firstLoopStationTimes,
    });
  }

  console.log(`生成 ${direction} 列车: 基础 ${baseCount} 列, 加车 ${morningExtraTimes.length + eveningExtraTimes.length} 列, 总计 ${trains.length} 列`);
  return trains;
}

export function generateAllTrains() {
  let trains = [];

  // 1号线
  trains.push(...generateTrainsForLine12('1号线', '上行', LINE1_STATIONS_UP, SEGMENT_TIMES_1_UP, 's23', 's1', 1));
  trains.push(...generateTrainsForLine12('1号线', '下行', LINE1_STATIONS_DOWN, SEGMENT_TIMES_1_DOWN, 's1', 's23', 1000));

  // 2号线
  trains.push(...generateTrainsForLine12('2号线', '上行', LINE2_STATIONS_UP, SEGMENT_TIMES_2_UP, 's42', 's24', 2000));
  trains.push(...generateTrainsForLine12('2号线', '下行', LINE2_STATIONS_DOWN, SEGMENT_TIMES_2_DOWN, 's24', 's42', 3000));

  // 3号线内环
  const innerSeq = buildInnerStationSequence();
  const innerTimes = getInnerSegmentTimes();
  const innerTrains = generateLine3Trains('内环', innerSeq, innerTimes, 's57', 4000);
  trains.push(...innerTrains);

  // 3号线外环
  const outerSeq = buildOuterStationSequence();
  const outerTimes = getOuterSegmentTimes();
  const outerTrains = generateLine3Trains('外环', outerSeq, outerTimes, 's56', 5000);
  trains.push(...outerTrains);

  console.log(`总共生成列车数: ${trains.length}`);
  return trains;
}
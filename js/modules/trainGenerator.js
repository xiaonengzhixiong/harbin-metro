import { OPERATION, PEAK_HOURS } from '../config.js';
import {
  LINE1_STATIONS_UP, LINE1_STATIONS_DOWN, SEGMENT_TIMES_1_UP, SEGMENT_TIMES_1_DOWN,
  LINE2_STATIONS_UP, LINE2_STATIONS_DOWN, SEGMENT_TIMES_2_UP, SEGMENT_TIMES_2_DOWN,
  FULL_STATIONS_3, FULL_TIMES_3
} from '../utils/constants.js';

function isPeakHour(t) {
  return PEAK_HOURS.some(p => t >= p.start && t <= p.end);
}

function getHeadway(t) {
  return isPeakHour(t) ? 300 : 420;
}

function generateTrainsForDirection(lineName, direction, stationIds, segmentTimes, startStationId, endStationId, startIdOffset) {
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
    const interval = getHeadway(currentTime);
    currentTime += interval;
    if (currentTime > OPERATION.lastTrain + 3600) break;
  }
  return trains;
}

// 内环：从 s57 出发，顺时针运行一圈回到 s57
function buildInnerLoop() {
  const start = "s57";
  const end = "s57";

  const startIdx = FULL_STATIONS_3.indexOf(start);
  let stations = [];
  let idx = startIdx;
  while (true) {
    stations.push(FULL_STATIONS_3[idx]);
    if (stations.length === FULL_STATIONS_3.length) break;
    idx = (idx + 1) % (FULL_STATIONS_3.length - 1);
  }

  const times = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    const fromIdx = FULL_STATIONS_3.indexOf(from);
    const nextIdx = (fromIdx + 1) % (FULL_STATIONS_3.length - 1);
    const expectedNext = FULL_STATIONS_3[nextIdx];
    if (expectedNext === to) {
      times.push(FULL_TIMES_3[fromIdx]);
    } else if (from === "s78" && to === "s43") {
      times.push(FULL_TIMES_3[FULL_TIMES_3.length - 1]);
    } else {
      console.error("内环区间不匹配", from, to);
    }
  }
  return { stations, times, start, end };
}

// 外环：从 s56 出发，逆时针运行一圈回到 s56
function buildOuterLoop() {
  const start = "s56";
  const end = "s56";

  const startIdx = FULL_STATIONS_3.indexOf(start);
  const stations = [];
  let idx = startIdx;
  while (true) {
    stations.push(FULL_STATIONS_3[idx]);
    if (stations.length === FULL_STATIONS_3.length) break;
    idx = (idx - 1 + (FULL_STATIONS_3.length - 1)) % (FULL_STATIONS_3.length - 1);
  }

  const times = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    const fromIdx = FULL_STATIONS_3.indexOf(from);
    const prevIdx = (fromIdx - 1 + (FULL_STATIONS_3.length - 1)) % (FULL_STATIONS_3.length - 1);
    const expectedPrev = FULL_STATIONS_3[prevIdx];
    if (expectedPrev === to) {
      times.push(FULL_TIMES_3[prevIdx]);
    } else if (from === "s43" && to === "s78") {
      times.push(FULL_TIMES_3[FULL_TIMES_3.length - 1]);
    } else {
      console.error("外环区间不匹配", from, to);
    }
  }
  return { stations, times, start, end };
}

export function generateAllTrains() {
  let trains = [];

  trains.push(...generateTrainsForDirection('1号线', '上行', LINE1_STATIONS_UP, SEGMENT_TIMES_1_UP, 's23', 's1', 1));
  trains.push(...generateTrainsForDirection('1号线', '下行', LINE1_STATIONS_DOWN, SEGMENT_TIMES_1_DOWN, 's1', 's23', 1000));

  trains.push(...generateTrainsForDirection('2号线', '上行', LINE2_STATIONS_UP, SEGMENT_TIMES_2_UP, 's42', 's24', 2000));
  trains.push(...generateTrainsForDirection('2号线', '下行', LINE2_STATIONS_DOWN, SEGMENT_TIMES_2_DOWN, 's24', 's42', 3000));

  // 3号线：内环（顺时针）从进乡街(s57)出发，顺时针运行一圈回到进乡街(s57)
  const innerLoop = buildInnerLoop();
  trains.push(...generateTrainsForDirection('3号线', '内环', innerLoop.stations, innerLoop.times, innerLoop.start, innerLoop.end, 4000));

  // 3号线：外环（逆时针）从汽轮机厂(s56)出发，逆时针运行一圈回到汽轮机厂(s56)
  const outerLoop = buildOuterLoop();
  trains.push(...generateTrainsForDirection('3号线', '外环', outerLoop.stations, outerLoop.times, outerLoop.start, outerLoop.end, 5000));

  return trains;
}
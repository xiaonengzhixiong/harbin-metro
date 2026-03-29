import { MapRenderer } from './modules/mapRenderer.js';
import { AnimationController } from './modules/animationController.js';
import { UIController } from './modules/uiController.js';
import { loadStations, loadLines } from './modules/dataLoader.js';
import { generateAllTrains } from './modules/trainGenerator.js';

class TrainManager {
  constructor(trains, stations) {
    this.trains = trains;
    this.stations = stations;
  }

  getTrainsAtTime(now) {
    const result = [];
    for (const train of this.trains) {
      if (now >= train.startTime && now <= train.endTime) {
        let currentSegmentIdx = -1;
        let segmentStartTime = train.startTime;
        for (let i = 0; i < train.stationIds.length - 1; i++) {
          const stationId = train.stationIds[i];
          const nextStationId = train.stationIds[i + 1];
          const arrivalThis = train.stationTimes[stationId];
          const arrivalNext = train.stationTimes[nextStationId];
          if (now >= arrivalThis && now <= arrivalNext) {
            currentSegmentIdx = i;
            segmentStartTime = arrivalThis;
            break;
          }
        }
        if (currentSegmentIdx === -1) continue;

        const startStationId = train.stationIds[currentSegmentIdx];
        const endStationId = train.stationIds[currentSegmentIdx + 1];
        const segmentDuration = train.segmentDurations[currentSegmentIdx];
        const elapsed = now - segmentStartTime;
        const ratio = elapsed / segmentDuration;
        const startStation = this.stations.find(s => s.id === startStationId);
        const endStation = this.stations.find(s => s.id === endStationId);
        if (!startStation || !endStation) continue;

        result.push({
          trainId: train.id,
          direction: train.direction,
          line: train.line,
          startStation: startStation,
          endStation: endStation,
          ratio: ratio,
          currentSegment: `${startStation.name} → ${endStation.name}`
        });
      }
    }
    return result;
  }
}

async function init() {
  const stations = await loadStations();
  const lines = await loadLines();

  const allTrains = generateAllTrains();
  const trainManager = new TrainManager(allTrains, stations);

  const mapRenderer = new MapRenderer('metroCanvas');
  mapRenderer.setStations(stations);
  mapRenderer.setLines(lines);
  mapRenderer.updateCanvasSize();
  mapRenderer.resetView();

  const animController = new AnimationController(mapRenderer, trainManager);
  const uiController = new UIController(animController, trainManager, mapRenderer);

  animController.start();

  window.addEventListener('resize', () => {
    mapRenderer.updateCanvasSize();
    mapRenderer.resetView();
    mapRenderer.draw();
  });
}

window.addEventListener('load', init);
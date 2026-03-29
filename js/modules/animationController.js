import { OPERATION, ANIMATION } from '../config.js';
import { formatTime } from '../utils/geo.js';

export class AnimationController {
  constructor(mapRenderer, trainManager) {
    this.mapRenderer = mapRenderer;
    this.trainManager = trainManager;
    this.simTime = OPERATION.firstTrain;
    this.isPlaying = true;
    this.speed = ANIMATION.defaultSpeed;
    this.animationId = null;
    this.lastTimestamp = 0;
    this.onTimeUpdate = null;
  }

  start() {
    if (this.animationId) return;
    this.lastTimestamp = 0;
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  loop(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const delta = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    if (this.isPlaying) {
      this.simTime += delta * this.speed;
      if (this.simTime > OPERATION.lastTrain + 3600) {
        this.simTime = OPERATION.firstTrain;
      }
      this.update();
    }
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  update() {
    const trainsAtTime = this.trainManager.getTrainsAtTime(this.simTime);
    this.mapRenderer.setTrains(trainsAtTime);
    this.mapRenderer.draw();
    if (this.onTimeUpdate) this.onTimeUpdate(this.simTime);
  }

  setTime(time) {
    this.simTime = Math.min(86400, Math.max(0, time));
    this.update();
  }

  setPlaying(playing) { this.isPlaying = playing; }
  setSpeed(speed) { this.speed = speed; }
  setTimeUpdateCallback(callback) { this.onTimeUpdate = callback; }
}
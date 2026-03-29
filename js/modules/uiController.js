import { ANIMATION } from '../config.js';
import { formatTime } from '../utils/geo.js';

export class UIController {
  constructor(animationController, trainManager, mapRenderer) {
    this.animController = animationController;
    this.trainManager = trainManager;
    this.mapRenderer = mapRenderer;
    this.initElements();
    this.bindEvents();
    this.initSpeedSlider();
    this.initTooltip();
  }

  initElements() {
    this.bigTimeDisplay = document.getElementById('bigTimeDisplay');
    this.timeDisplay = document.getElementById('timeDisplay');
    this.timeSlider = document.getElementById('timeSlider');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedDisplay = document.getElementById('speedDisplay');
    this.trainCountLine1 = document.getElementById('trainCountLine1');
    this.trainCountLine2 = document.getElementById('trainCountLine2');
    this.trainCountLine3 = document.getElementById('trainCountLine3');
    this.totalTrainCount = document.getElementById('totalTrainCount');
    this.tooltip = document.getElementById('tooltip');
  }

  bindEvents() {
    this.playPauseBtn.addEventListener('click', () => {
      this.animController.setPlaying(!this.animController.isPlaying);
      this.playPauseBtn.textContent = this.animController.isPlaying ? '⏸ 暂停' : '▶ 播放';
    });

    this.timeSlider.addEventListener('input', (e) => {
      if (!this.animController.isPlaying) {
        this.animController.setTime(parseInt(e.target.value));
      }
    });

    this.animController.setTimeUpdateCallback((time) => {
      this.updateTimeDisplay(time);
      this.updateTrainCount(time);
    });
  }

  initSpeedSlider() {
    const speedLevels = [1];
    for (let i = 10; i <= ANIMATION.maxSpeed; i += 10) speedLevels.push(i);
    const speedLabels = speedLevels.map(v => `${v}x`);
    const defaultLevel = speedLevels.indexOf(ANIMATION.defaultSpeed);
    this.speedSlider.max = speedLevels.length - 1;
    this.speedSlider.value = defaultLevel;
    this.speedDisplay.textContent = speedLabels[defaultLevel];

    this.speedSlider.addEventListener('input', (e) => {
      const level = parseInt(e.target.value);
      const newSpeed = speedLevels[level];
      this.animController.setSpeed(newSpeed);
      this.speedDisplay.textContent = speedLabels[level];
    });
  }

  initTooltip() {
    const canvas = this.mapRenderer.canvas;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const train = this.mapRenderer.getTrainAtCanvasPoint(canvasX, canvasY);
      if (train) {
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (e.clientX + 10) + 'px';
        this.tooltip.style.top = (e.clientY - 20) + 'px';
        this.tooltip.innerHTML = `${train.direction} ${train.currentSegment}`;
      } else {
        this.tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      this.tooltip.style.display = 'none';
    });
  }

  updateTimeDisplay(time) {
    const timeStr = formatTime(time);
    if (this.timeDisplay) this.timeDisplay.textContent = timeStr;
    if (this.bigTimeDisplay) this.bigTimeDisplay.textContent = timeStr;
    if (this.timeSlider) this.timeSlider.value = time;
}

  updateTrainCount(currentTime) {
    const trains = this.trainManager.getTrainsAtTime(currentTime);
    let count1 = 0, count2 = 0, count3 = 0;
    trains.forEach(train => {
      if (train.line === '1号线') count1++;
      else if (train.line === '2号线') count2++;
      else if (train.line === '3号线') count3++;
    });
    this.trainCountLine1.textContent = count1;
    this.trainCountLine2.textContent = count2;
    this.trainCountLine3.textContent = count3;
    this.totalTrainCount.textContent = trains.length;
  }
}
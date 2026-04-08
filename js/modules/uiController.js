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
    this.timeDisplay = document.getElementById('timeDisplay');
    this.bigTimeDisplay = document.getElementById('bigTimeDisplay');
    this.timeSlider = document.getElementById('timeSlider');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedDisplay = document.getElementById('speedDisplay');
    this.trainCountLine1 = document.getElementById('trainCountLine1');
    this.trainCountLine2 = document.getElementById('trainCountLine2');
    this.trainCountLine3 = document.getElementById('trainCountLine3');
    this.totalTrainCount = document.getElementById('totalTrainCount');
    this.tooltip = document.getElementById('tooltip');
    this.bigTimeDisplay = document.getElementById('bigTimeDisplay');
    this.initBigTimeEditable();
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
    if (this.trainCountLine1) this.trainCountLine1.textContent = count1;
    if (this.trainCountLine2) this.trainCountLine2.textContent = count2;
    if (this.trainCountLine3) this.trainCountLine3.textContent = count3;
    if (this.totalTrainCount) this.totalTrainCount.textContent = trains.length;
  }

initBigTimeEditable() {
    if (!this.bigTimeDisplay) return;
    this.bigTimeDisplay.style.cursor = 'pointer';
    this.bigTimeDisplay.title = '点击编辑时间';

    // 获取计算后的样式
    const computedStyle = window.getComputedStyle(this.bigTimeDisplay);

    this.bigTimeDisplay.addEventListener('click', () => {
        const currentText = this.bigTimeDisplay.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        // 直接复制所有与视觉相关的样式
        input.style.width = computedStyle.width;
        input.style.height = computedStyle.height;
        input.style.fontFamily = computedStyle.fontFamily;
        input.style.fontSize = computedStyle.fontSize;
        input.style.fontWeight = computedStyle.fontWeight;
        input.style.textAlign = computedStyle.textAlign;
        input.style.backgroundColor = computedStyle.backgroundColor;
        input.style.color = computedStyle.color;
        input.style.border = computedStyle.border;
        input.style.borderRadius = computedStyle.borderRadius;
        input.style.padding = computedStyle.padding;
        input.style.margin = computedStyle.margin;
        input.style.letterSpacing = computedStyle.letterSpacing;
        input.style.boxShadow = computedStyle.boxShadow;
        input.style.outline = 'none';
        // 确保宽高一致
        input.style.boxSizing = 'border-box';

        this.bigTimeDisplay.style.display = 'none';
        this.bigTimeDisplay.parentNode.insertBefore(input, this.bigTimeDisplay);
        input.focus();

        const finishEdit = () => {
            const newValue = input.value.trim();
            if (newValue) {
                const seconds = this.parseTimeString(newValue);
                if (!isNaN(seconds)) {
                    this.animController.setTime(seconds);
                } else {
                    alert('时间格式错误，请使用 HH:MM:SS 或 HH:MM');
                }
            }
            input.remove();
            this.bigTimeDisplay.style.display = '';
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') finishEdit();
        });
    });
}

 parseTimeString(str) {
    const parts = str.split(':');
    if (parts.length < 2) return NaN;
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1], 10);
    let seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return NaN;
    if (hours < 0 || hours > 23) return NaN;
    if (minutes < 0 || minutes > 59) return NaN;
    if (seconds < 0 || seconds > 59) return NaN;
    return hours * 3600 + minutes * 60 + seconds;
 }
}
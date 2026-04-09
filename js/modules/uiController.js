import { ANIMATION } from '../config.js';
import { formatTime } from '../utils/geo.js';
import { PEAK_HOURS } from '../config.js';

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
    // 说明文档相关元素
    this.docLink = document.getElementById('docLink');
    this.modal = document.getElementById('docModal');
    this.closeBtn = document.querySelector('.close');
    this.modalBody = document.querySelector('.modal-body');
    // 填充说明内容
    if (this.modalBody) {
      this.modalBody.innerHTML = this.getDocContent();
    }
    this.initBigTimeEditable();
  }

  getDocContent() {
    return `
      <h3>1. 概述</h3>
      <p>本系统通过调取哈尔滨地铁的线路、车站、首末班车时间、运营间隔和运营时间，构建了一个可以查看一天内特定时间的列车位置和运营间隔的可视化系统。资料来源：微信公众号"冰城出行"（<a href="https://mp.weixin.qq.com/s/1JcKFg3SJYV4vX4d9Tzgmw" target="_blank">mp.weixin.qq.com/s/1JcKFg3SJYV4vX4d9Tzgmw</a>）。由于哈尔滨地铁官方并未在网上发布具体的列车发车时刻表，因此全天行车时刻均为根据首末班车时间和部分官方消息进行推断，不代表真实时刻表。</p>

      <h3>2. 开发流程</h3>
      <p>总开发时间约为15小时。</p>
      <p>搜集查证资料耗时约2小时。一开始一直在努力寻找官方渠道发布的列车时刻表，但是发现官方没有发过这些东西。遂结合其他地铁爱好者的首末班车时刻表自行编排列车运营时刻表。1、2号线的时刻表相对好排，3号线由于是环线，运营交路相对复杂，因此耗时较长。</p>
      <p>取点并完成地铁拓扑图画布耗时约2小时。拓扑图取点来自于微信小程序MetroMan绘制的哈尔滨地铁线路图。起初想要使用地理线路图，但是画出的效果并不好，线路较为扭曲，因此放弃。</p>
      <p>编排UI耗时约2小时。其中最耗费时间的画面右上角的大时钟。该大时钟可以点击输入时间，导入字体、调整大小、调整早晚高峰时的时钟呼吸灯高亮均耗费了一番心思。</p>
      <p>敲代码实现列车在线路上运营耗时约6小时。其中1小时在调整1、2号线的发车逻辑，其余4小时一直在弄3号线。（请允许我用一大段文字为您描述一下当前哈尔滨地铁3号线的运营逻辑：运营时间开始，由于车库在汽轮机厂和进乡街站中间，因此内环列车，即顺时针列车需要从进乡街站发车；外环列车，即逆时针列车需要从汽轮机厂站发车，以8分钟一班的间隔从车库发车，所有列车绕环线一圈一圈地运营。早晚高峰开始时，需要增大列车密度，应对大客流，因此每隔一班车再加开一班车，结束后从对应的回库站点回库。这样的逻辑在全国环线地铁中算是最为简单的一批，我还对其中的一些技术难点进行了部分简化）另外，将鼠标靠近代表列车的圆点可以显示列车运营方向和所在区间。</p>
      <p>修复bug、调整优化、收尾工作耗时约3小时。其中最为严重的bug还是来自3号线，包括但不限于从错误的站点发车、收车，列车运营到一半凭空消失，只有内环车没有外环车，列车在末班车后不收车等。3号线就像个邪神，一路阻碍开发进程。好在最后bug都被修好了，感谢自己和DeepSeek的汗马功劳。</p>

      <h3>本可视化仅用于课堂交流及学习参考，严禁用于房地产等商业功能。</h3>
    `;
  }

  updatePeakGlow(time) {
    if (!this.bigTimeDisplay) return;
    const isPeak = PEAK_HOURS.some(p => time >= p.start && time <= p.end);
    if (isPeak) {
      this.bigTimeDisplay.classList.add('peak');
    } else {
      this.bigTimeDisplay.classList.remove('peak');
    }
  }

  updateTimeDisplay(time) {
    const timeStr = formatTime(time);
    if (this.timeDisplay) this.timeDisplay.textContent = timeStr;
    if (this.bigTimeDisplay) this.bigTimeDisplay.textContent = timeStr;
    if (this.timeSlider) this.timeSlider.value = time;
    this.updatePeakGlow(time);
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

    // 说明文档链接点击事件
    if (this.docLink) {
      this.docLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.modal) this.modal.style.display = 'block';
      });
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        if (this.modal) this.modal.style.display = 'none';
      });
    }
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.modal.style.display = 'none';
      }
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

    const computedStyle = window.getComputedStyle(this.bigTimeDisplay);

    this.bigTimeDisplay.addEventListener('click', () => {
      const currentText = this.bigTimeDisplay.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentText;
      // 复制视觉样式
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

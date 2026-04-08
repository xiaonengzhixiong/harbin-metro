import { LINE_COLORS } from '../config.js';

// 重要站点 ID 列表（缩放较小时只显示这些站名）
const IMPORTANT_STATION_IDS = new Set([
  // 换乘站
  's8', 's31', 's4', 's47', 's16', 's62', 's27', 's53', 's35', 's76',
  // 终点站
  's1', 's23', 's24', 's42',
  // 其他指定站点
  's51', 's49', 's57', 's60', 's65', 's67', 's71', 's74', 's43', 's45',
  's38', 's33', 's29', 's6', 's10', 's13', 's18'
]);

export class MapRenderer {
  constructor(canvasId, labelThreshold = 0.6) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.labelThreshold = labelThreshold;  // 缩放阈值，大于此值显示全部站名且字体固定
    this.stations = [];
    this.lines = [];
    this.currentTrains = [];
    this.currentTrainPositions = [];
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.initInteraction();
  }

  setStations(stations) { this.stations = stations; }
  setLines(lines) { this.lines = lines; }
  setTrains(trains) { this.currentTrains = trains; }

  updateCanvasSize() {
    const container = document.querySelector('.canvas-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    this.width = containerRect.width;
    this.height = containerRect.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    return { width: this.width, height: this.height };
  }

  resetView() {
    if (!this.stations.length) return;
    const points = this.stations.map(s => ({ x: s.x, y: s.y }));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    const padding = 40;
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;
    const scaleX = (this.width - padding * 2) / worldWidth;
    const scaleY = (this.height - padding * 2) / worldHeight;
    this.scale = Math.min(scaleX, scaleY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const canvasCenterX = this.width / 2;
    const canvasCenterY = this.height / 2;
    this.offsetX = canvasCenterX - centerX * this.scale;
    this.offsetY = canvasCenterY - centerY * this.scale;
    this.draw();
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    this.drawLines();
    this.drawStations();      // 注意：drawStations 内部会处理文字的不缩放
    this.drawTrains();
    this.ctx.restore();
  }

  drawLines() {
    this.lines.forEach(line => {
      const points = line.stations
        .map(id => this.stations.find(s => s.id === id))
        .filter(s => s)
        .map(s => ({ x: s.x, y: s.y }));
      if (points.length < 2) return;
      const path = new Path2D();
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
      this.ctx.beginPath();
      this.ctx.strokeStyle = line.color;
      this.ctx.lineWidth = 4 / this.scale;
      this.ctx.lineCap = 'round';
      this.ctx.stroke(path);
    });
  }

  drawStations() {
  const showAllLabels = this.scale >= this.labelThreshold;
  const baseFontSize = 14;
  const minFontSize = 10;

  for (const station of this.stations) {
    // 绘制圆点（不变）
    this.ctx.beginPath();
    this.ctx.arc(station.x, station.y, 4 / this.scale, 0, 2 * Math.PI);
    this.ctx.fillStyle = 'white';
    this.ctx.fill();
    this.ctx.strokeStyle = LINE_COLORS[station.line] || '#999';
    this.ctx.lineWidth = 2 / this.scale;
    this.ctx.stroke();

    // 判断是否显示文字
    let shouldDrawLabel = false;
    if (showAllLabels) {
      shouldDrawLabel = true;
    } else if (IMPORTANT_STATION_IDS.has(station.id)) {
      shouldDrawLabel = true;
    }

    if (shouldDrawLabel) {
      // 获取偏移量：优先使用自定义偏移，否则使用默认值 (6, -4)
      const offset = station.label_offset || { x: 6, y: -4 };
      const screenX = station.x * this.scale + this.offsetX;
      const screenY = station.y * this.scale + this.offsetY;

      // 计算字体大小（不变）
      let fontSize;
      if (this.scale >= this.labelThreshold) {
        fontSize = baseFontSize;
      } else {
        fontSize = Math.max(minFontSize, baseFontSize * (this.scale / this.labelThreshold));
      }

      // 重置变换并绘制文字
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.font = `${fontSize}px "Microsoft YaHei"`;
      this.ctx.fillStyle = '#333';
      this.ctx.fillText(station.name, screenX + offset.x, screenY + offset.y);
      this.ctx.restore();
    }
  }
}

  drawTrains() {
    this.currentTrainPositions = [];
    if (!this.currentTrains.length) return;
    for (const trainInfo of this.currentTrains) {
      const startStation = trainInfo.startStation;
      const endStation = trainInfo.endStation;
      if (!startStation || !endStation) continue;
      const startPos = { x: startStation.x, y: startStation.y };
      const endPos = { x: endStation.x, y: endStation.y };
      const x = startPos.x + (endPos.x - startPos.x) * trainInfo.ratio;
      const y = startPos.y + (endPos.y - startPos.y) * trainInfo.ratio;
      this.currentTrainPositions.push({
        x, y,
        trainId: trainInfo.trainId,
        direction: trainInfo.direction,
        line: trainInfo.line,
        currentSegment: trainInfo.currentSegment
      });
      this.ctx.beginPath();
      this.ctx.arc(x, y, 7 / this.scale, 0, 2 * Math.PI);
      if (trainInfo.line === '1号线') this.ctx.fillStyle = '#C8102E';
      else if (trainInfo.line === '2号线') this.ctx.fillStyle = '#00AB59';
      else this.ctx.fillStyle = '#FFC72C';
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1.5 / this.scale;
      this.ctx.stroke();
    }
  }

  getTrainAtCanvasPoint(canvasX, canvasY) {
    const worldX = (canvasX - this.offsetX) / this.scale;
    const worldY = (canvasY - this.offsetY) / this.scale;
    const threshold = 15 / this.scale;
    for (const pos of this.currentTrainPositions) {
      const dx = pos.x - worldX;
      const dy = pos.y - worldY;
      if (Math.sqrt(dx*dx + dy*dy) <= threshold) return pos;
    }
    return null;
  }

  initInteraction() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const canvasMouseX = mouseX;
      const canvasMouseY = mouseY;
      const zoom = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(5, Math.max(0.5, this.scale * zoom));
      if (newScale !== this.scale) {
        const mouseWorldX = (canvasMouseX - this.offsetX) / this.scale;
        const mouseWorldY = (canvasMouseY - this.offsetY) / this.scale;
        this.scale = newScale;
        this.offsetX = canvasMouseX - mouseWorldX * this.scale;
        this.offsetY = canvasMouseY - mouseWorldY * this.scale;
        this.draw();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const rect = this.canvas.getBoundingClientRect();
      const canvasMouseX = e.clientX - rect.left;
      const canvasMouseY = e.clientY - rect.top;
      this.dragStart = { x: canvasMouseX - this.offsetX, y: canvasMouseY - this.offsetY };
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const rect = this.canvas.getBoundingClientRect();
      const canvasMouseX = e.clientX - rect.left;
      const canvasMouseY = e.clientY - rect.top;
      this.offsetX = canvasMouseX - this.dragStart.x;
      this.offsetY = canvasMouseY - this.dragStart.y;
      this.draw();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });
    this.canvas.style.cursor = 'grab';
  }
}
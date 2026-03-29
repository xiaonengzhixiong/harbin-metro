export const LINE_COLORS = {
  '1号线': '#C8102E',
  '2号线': '#00AB59',
  '3号线': '#FFC72C'
};

export const OPERATION = {
  firstTrain: 5.5 * 3600,
  lastTrain: 22.5 * 3600
};

export const PEAK_HOURS = [
  { start: 7 * 3600, end: 9 * 3600 },
  { start: 17 * 3600, end: 19 * 3600 }
];

export const ANIMATION = {
  initialTime: OPERATION.firstTrain,
  defaultSpeed: 30,
  maxSpeed: 200,
  minSpeed: 1
};
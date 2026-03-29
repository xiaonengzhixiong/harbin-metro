export async function loadStations() {
  const res = await fetch('data/stations.json');
  const data = await res.json();
  return data.stations;
}

export async function loadLines() {
  const res = await fetch('data/lines.json');
  const data = await res.json();
  return data.lines;
}
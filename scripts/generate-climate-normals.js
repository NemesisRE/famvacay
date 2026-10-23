/**
 * Climate Normals Generator
 *
 * Builds src/lib/optimizer/data/climate-normals.json - monthly climate normals for every destination
 * the optimizer can suggest (airports with airline routes + the overland "surface" destinations) -
 * from the NASA POWER climatology API (https://power.larc.nasa.gov, public domain, MERRA-2 based).
 *
 * Per destination: 12 x mean temperature (°C, corrected from the grid cell's elevation to the
 * destination's), 12 x mean daily temperature range (°C), 12 x precipitation (mm/day).
 * Format: { "AYT": [t1..t12, range1..range12, precip1..precip12], ... }
 *
 * POWER's grid cells are ~0.5° x 0.625°, so destinations sharing a cell share one request.
 * Interrupted runs resume from a cache file in the OS temp directory.
 *
 * Usage: node scripts/generate-climate-normals.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const airports = require('../src/lib/airports/data/airports.json');
const routes = require('../src/lib/airports/data/flight-routes.json');
const outFile = path.join(__dirname, '../src/lib/optimizer/data/climate-normals.json');
const cacheFile = path.join(os.tmpdir(), 'famvacay-climate-normals-cache.json');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const LAPSE_RATE = 0.0055; // °C per metre (between the standard 0.0065 and coastal/moist conditions)
const CONCURRENCY = 2;

// ---- destinations ----
const points = [];
for (const a of airports) {
  if (!routes[a.code]) continue;
  points.push({ code: a.code, lat: a.lat, lon: a.lon, elevation: (a.altitude || 0) * 0.3048 });
}
const surfaceSrc = fs.readFileSync(path.join(__dirname, '../src/lib/geo/surface-destinations.ts'), 'utf8');
for (const line of surfaceSrc.split('\n')) {
  const m = line.match(/node\('([^']+)',.*?'([A-Z]{2}-[A-Z0-9]+)',\s*(-?[\d.]+),\s*(-?[\d.]+)/);
  if (!m) continue;
  const alt = line.match(/altitudeMeters:\s*(\d+)/);
  points.push({ code: `srf:${m[1]}`, lat: +m[3], lon: +m[4], elevation: alt ? +alt[1] : 5 });
}

// ---- grid cells ----
const cellOf = (lat, lon) => {
  const cLat = Math.round(lat / 0.5) * 0.5;
  const cLon = Math.round(lon / 0.625) * 0.625;
  return `${cLat.toFixed(2)},${cLon.toFixed(3)}`;
};
const cells = [...new Set(points.map((p) => cellOf(p.lat, p.lon)))];

let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
} catch {
  cache = {};
}

async function fetchCell(cell) {
  const [lat, lon] = cell.split(',');
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_RANGE,PRECTOTCORR&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'famvacay-climate-generator/1.0 (https://famvacay.us)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const p = data.properties.parameter;
      const elevation = data.geometry?.coordinates?.[2] ?? 0;
      return {
        elevation,
        t: MONTHS.map((m) => p.T2M[m]),
        range: MONTHS.map((m) => p.T2M_RANGE[m]),
        precip: MONTHS.map((m) => p.PRECTOTCORR[m]),
      };
    } catch (err) {
      if (attempt === 4) throw err;
      // NASA POWER throttles bursts (HTTP 429): back off generously
      await new Promise((r) => setTimeout(r, (String(err.message).includes('429') ? 15000 : 2000) * attempt));
    }
  }
}

async function main() {
  const todo = cells.filter((c) => !cache[c]);
  console.log(`${points.length} destinations in ${cells.length} grid cells, ${todo.length} to fetch`);
  let done = 0;
  let failed = 0;
  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const cell = queue.shift();
      try {
        cache[cell] = await fetchCell(cell);
      } catch (err) {
        failed++;
        console.warn(`  ${cell}: ${err.message}`);
      }
      done++;
      if (done % 50 === 0) {
        fs.writeFileSync(cacheFile, JSON.stringify(cache));
        console.log(`  ${done}/${todo.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(cacheFile, JSON.stringify(cache));

  const result = {};
  for (const p of points) {
    const c = cache[cellOf(p.lat, p.lon)];
    if (!c || c.t.some((v) => v === -999 || v === undefined)) continue;
    const correction = (c.elevation - p.elevation) * LAPSE_RATE;
    result[p.code] = [
      ...c.t.map((v) => Math.round(v + correction)),
      ...c.range.map((v) => Math.round(v)),
      ...c.precip.map((v) => Math.round(v * 10) / 10),
    ];
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result));
  console.log(`${Object.keys(result).length} destinations -> ${path.relative(process.cwd(), outFile)} (${fs.statSync(outFile).size} bytes), ${failed} cells failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

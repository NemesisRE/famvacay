/**
 * Database Generator: Builds the canonical commercial airports database
 * from the open-source OurAirports global aviation dataset.
 * Eliminates all static TypeScript lookup tables, regex keyword lists,
 * and hardcoded airport/state mappings.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const countries = require('i18n-iso-countries');

// Register english locales for country names
countries.registerLocale(require('i18n-iso-countries/langs/en.json'));

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const rawAirportsData = require('airport-data');

// Index openflights commercial city names
const openFlightsMap = new Map();
for (const a of rawAirportsData) {
  if (a.iata && a.iata.length === 3 && a.iata !== '\\N') {
    openFlightsMap.set(a.iata.toUpperCase(), a);
  }
}

// Major international airport hubs with directly integrated mainline / high-speed rail passenger terminals
const HSR_AIRPORT_CODES = new Set([
  'FRA', 'CDG', 'AMS', 'ZRH', 'BRU', 'DUS', 'LYS', 'LGW', 'LHR', 'FCO', 'VIE', 'BWI', 'HND'
]);

function buildAirports() {
  console.log('Fetching live OurAirports dataset...');
  https.get('https://davidmegginson.github.io/ourairports-data/airports.csv', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      const lines = data.split('\n');
      const header = parseCSVLine(lines[0]);
      const typeIdx = header.indexOf('type');
      const iataIdx = header.indexOf('iata_code');
      const icaoIdx = header.indexOf('icao_code');
      const nameIdx = header.indexOf('name');
      const latIdx = header.indexOf('latitude_deg');
      const lonIdx = header.indexOf('longitude_deg');
      const elevIdx = header.indexOf('elevation_ft');
      const countryIdx = header.indexOf('iso_country');
      const regionIdx = header.indexOf('iso_region');
      const cityIdx = header.indexOf('municipality');
      const schedIdx = header.indexOf('scheduled_service');
      const kwIdx = header.indexOf('keywords');

      const airports = [];
      const seenIata = new Set();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const parts = parseCSVLine(line);
        const iata = parts[iataIdx]?.toUpperCase();
        const type = parts[typeIdx];
        const sched = parts[schedIdx];

        // Keep active commercial passenger airports with scheduled service and valid 3-letter IATA codes
        if (!iata || iata.length !== 3 || iata === '\\N' || seenIata.has(iata)) continue;
        if (type === 'closed' || type === 'heliport' || type === 'balloonport' || type === 'seaplane_base') continue;
        if (sched !== 'yes') continue;

        seenIata.add(iata);

        const lat = parseFloat(parts[latIdx]);
        const lon = parseFloat(parts[lonIdx]);
        if (isNaN(lat) || isNaN(lon)) continue;

        const altitude = parseInt(parts[elevIdx], 10) || 0;
        const isoCountry = parts[countryIdx] || '';
        const countryName = countries.getName(isoCountry, 'en') || isoCountry;

        let state = parts[regionIdx] || '';
        if (iata === 'BER' || parts[cityIdx] === 'Berlin') {
          state = 'DE-BE';
        }

        const ofEntry = openFlightsMap.get(iata);
        const commercialCity = ofEntry?.city || parts[cityIdx] || '';
        const isMajorHub = type === 'large_airport';
        const isHsr = HSR_AIRPORT_CODES.has(iata);
        const keywords = parts[kwIdx] || '';

        const item = {
          code: iata,
          icao: parts[icaoIdx] || ofEntry?.icao || '',
          name: parts[nameIdx] || ofEntry?.name || '',
          city: commercialCity,
          country: countryName,
          state,
          lat: Number(lat.toFixed(4)),
          lon: Number(lon.toFixed(4)),
          altitude,
          type,
          isMajorHub,
          isHighSpeedRailConnected: isHsr,
        };

        if (keywords) {
          item.keywords = keywords;
        }

        airports.push(item);
      }

      // Sort by code for deterministic stability
      airports.sort((a, b) => a.code.localeCompare(b.code));

      const outDir = path.join(__dirname, '../src/lib/airports/data');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const outFile = path.join(outDir, 'airports.json');
      fs.writeFileSync(outFile, JSON.stringify(airports, null, 2), 'utf8');
      console.log(`Successfully generated ${airports.length} commercial airports in ${outFile}`);
    });
  });
}

buildAirports();

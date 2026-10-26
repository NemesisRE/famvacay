import { describe, it, expect } from 'vitest';
import { buildRouteNetwork, groupByAirline, linkTargets, passengerDestinationsText } from '../generators/flight-routes';

const ARTICLE = `{{Infobox airport}}
Intro [[Red Sea]].
==History==
[[Cairo International Airport|Cairo]] opened earlier.
==Airlines and destinations==
===Passenger===
<!--DO NOT ADD ROUTES WITHOUT A SOURCE [[Fake Airport]]-->
{{Airport-dest-list
| [[Air Cairo]] | [[Frankfurt Airport|Frankfurt]],<ref name="a">{{Cite web|url=x|title=[[Ref Airport]]}}</ref> [[stuttgart Airport|Stuttgart]]<ref name="a"/>
| [[EasyJet]] | '''Seasonal:''' [[Geneva Airport#Terminal|Geneva]]{{efn|group=dest|Operates via [[Hurghada International Airport|Hurghada]]; {{nowrap|seasonal}}}}
}}
===Cargo===
{{Airport-dest-list
| [[Cargo Air]] | [[Leipzig/Halle Airport|Leipzig]]
}}
==Statistics==
[[Munich Airport]]
`;

const AIRPORTS: Record<string, string> = {
  'Frankfurt Airport': 'FRA',
  'Stuttgart Airport': 'STR',
  'Geneva Airport': 'GVA',
  'Suvarnabhumi Airport': 'BKK',
  'Ngurah Rai International Airport': 'DPS',
  'Singapore Changi Airport': 'SIN',
};

const COORDS: Record<string, { lat: number; lon: number }> = {
  FRA: { lat: 50.033, lon: 8.57 },
  BKK: { lat: 13.69, lon: 100.75 },
  DPS: { lat: -8.748, lon: 115.167 },
  SIN: { lat: 1.364, lon: 103.991 },
  AKL: { lat: -37.008, lon: 174.792 },
};

const listing = (entries: Record<string, Record<string, string[]>>) =>
  new Map(Object.entries(entries).map(([a, airlines]) => [a, new Map(Object.entries(airlines).map(([x, d]) => [x, new Set(d)]))]));

describe('Wikipedia route table parsing', () => {
  it('reads only the passenger destinations, without comments, references, footnotes or cargo', () => {
    const links = linkTargets(passengerDestinationsText(ARTICLE));
    expect(links).toEqual(['Air Cairo', 'Frankfurt Airport', 'Stuttgart Airport', 'EasyJet', 'Geneva Airport']);
  });

  it('leaves out destinations whose route has already ended', () => {
    const text = "| [[Condor (airline)|Condor]] | [[Frankfurt Airport|Frankfurt]] (ends 25 October 2025), [[Stuttgart Airport|Stuttgart]] (ends 31 March 2027), [[Geneva Airport|Geneva]] (begins 1 May 2026)";
    expect(linkTargets(text, new Date('2026-10-26'))).toEqual(['Condor (airline)', 'Stuttgart Airport', 'Geneva Airport']);
  });

  it('returns nothing for articles without a destinations section', () => {
    expect(passengerDestinationsText('==History==\n[[Frankfurt Airport]]')).toBe('');
  });

  it('groups destinations by the airline listed before them', () => {
    const groups = groupByAirline(linkTargets(passengerDestinationsText(ARTICLE)), (t) => AIRPORTS[t]);
    expect([...groups.entries()].map(([a, d]) => [a, [...d]])).toEqual([
      ['Air Cairo', ['FRA', 'STR']],
      ['EasyJet', ['GVA']],
    ]);
  });

  it('does not mistake an airport outside the dataset for the next airline', () => {
    const groups = groupByAirline(
      ['Condor (airline)', 'Alexandria International Airport (Egypt)', 'Frankfurt Airport'],
      (t) => AIRPORTS[t]
    );
    expect([...groups.keys()]).toEqual(['Condor (airline)']);
  });
});

describe('Route network from the destination lists', () => {
  const has = (adj: Map<string, Set<string>>, a: string, b: string) => Boolean(adj.get(a)?.has(b));

  it('leaves out the far leg of a through flight (Condor Frankfurt - Bangkok - Denpasar)', () => {
    const { adjacency } = buildRouteNetwork(
      listing({
        // Frankfurt is Condor's base: many destinations, so only the outpost end gives it away
        FRA: { Condor: ['BKK', 'DPS', 'PMI', 'HRG', 'CUN', 'JFK', 'TFS'] },
        DPS: { Condor: ['BKK', 'FRA'] },
        BKK: { Condor: ['FRA', 'DPS'] },
      }),
      (c) => COORDS[c]
    );
    expect(has(adjacency, 'FRA', 'BKK')).toBe(true);
    expect(has(adjacency, 'BKK', 'DPS')).toBe(true);
    expect(has(adjacency, 'FRA', 'DPS')).toBe(false);
  });

  it('keeps a real non-stop flight next to a flight to a stop on the way (Lufthansa Frankfurt - Singapore)', () => {
    const { adjacency } = buildRouteNetwork(
      listing({
        FRA: { Lufthansa: ['BKK', 'SIN'] },
        SIN: { Lufthansa: ['FRA'] },
        BKK: { Lufthansa: ['FRA'] },
      }),
      (c) => COORDS[c]
    );
    expect(has(adjacency, 'FRA', 'SIN')).toBe(true);
  });

  it('keeps non-stop flights to an airline base that happens to lie beyond another of its stops (airBaltic Athens - Tallinn)', () => {
    const coords: Record<string, { lat: number; lon: number }> = {
      ATH: { lat: 37.936, lon: 23.947 },
      RIX: { lat: 56.924, lon: 23.971 },
      TLL: { lat: 59.413, lon: 24.833 },
    };
    const { adjacency } = buildRouteNetwork(
      listing({
        ATH: { airBaltic: ['RIX', 'TLL'] },
        TLL: { airBaltic: ['ATH', 'RIX', 'OSL', 'CPH', 'ARN'] },
      }),
      (c) => coords[c]
    );
    expect(has(adjacency, 'ATH', 'TLL')).toBe(true);
  });

  it('keeps short and medium-haul flights from several bases of one airline (Norwegian Oslo/Copenhagen - Pula)', () => {
    const coords: Record<string, { lat: number; lon: number }> = {
      OSL: { lat: 60.194, lon: 11.1 },
      CPH: { lat: 55.618, lon: 12.656 },
      PUY: { lat: 44.894, lon: 13.922 },
    };
    const { adjacency } = buildRouteNetwork(
      listing({
        OSL: { Norwegian: ['CPH', 'PUY'] },
        PUY: { Norwegian: ['OSL', 'CPH'] },
      }),
      (c) => coords[c]
    );
    expect(has(adjacency, 'OSL', 'PUY')).toBe(true);
  });

  it('keeps long-haul flights from several bases of one airline (SAS Stockholm/Copenhagen - Tenerife)', () => {
    const coords: Record<string, { lat: number; lon: number }> = {
      ARN: { lat: 59.652, lon: 17.919 },
      CPH: { lat: 55.618, lon: 12.656 },
      TFS: { lat: 28.044, lon: -16.573 },
    };
    const { adjacency } = buildRouteNetwork(
      listing({
        ARN: { SAS: ['CPH', 'TFS'] },
        TFS: { SAS: ['ARN', 'CPH'] },
        CPH: { SAS: ['ARN', 'TFS', 'OSL', 'BCN', 'LHR', 'NCE'] },
      }),
      (c) => coords[c]
    );
    expect(has(adjacency, 'ARN', 'TFS')).toBe(true);
  });

  it('keeps the leg when another airline flies it non-stop', () => {
    const { adjacency } = buildRouteNetwork(
      listing({
        FRA: { Condor: ['BKK', 'DPS'], Garuda: ['DPS'] },
        DPS: { Condor: ['BKK', 'FRA'], Garuda: ['FRA'] },
      }),
      (c) => COORDS[c]
    );
    expect(has(adjacency, 'FRA', 'DPS')).toBe(true);
  });

  it('never lists a "non-stop" flight beyond any airliner range', () => {
    const { adjacency } = buildRouteNetwork(listing({ FRA: { Air: ['AKL'] } }), (c) => COORDS[c]);
    expect(has(adjacency, 'FRA', 'AKL')).toBe(false);
  });
});

export interface SampleFlightItem {
  id: string;
  name: string;
  description: string;
  path: string;
  badge: string;
}

export const SAMPLE_FLIGHTS: SampleFlightItem[] = [
  {
    id: 'sfo-las',
    name: 'SFO → LAS Scenic',
    description: 'Realistic mountain climb to 34,000ft, cruise, and descent into Las Vegas.',
    path: '/samples/flight-with-altitude.kml',
    badge: 'Altitude Profile',
  },
  {
    id: 'lhr-cdg-timestamps',
    name: 'LHR → CDG Shuttle',
    description: 'KML gx:Track format with original GPS recorded ISO timestamps.',
    path: '/samples/flight-with-timestamps.kml',
    badge: 'gx:Track GPS',
  },
  {
    id: 'jfk-lhr-long',
    name: 'JFK → LHR Transatlantic',
    description: 'Great-circle intercontinental ocean route testing long-distance smoothness.',
    path: '/samples/flight-long-distance.kml',
    badge: 'Long Haul',
  },
  {
    id: 'tokyo-osaka-flat',
    name: 'HND → ITM (Ground Track)',
    description: 'Route without altitude records (clampToGround) to test altitude simulation.',
    path: '/samples/flight-no-altitude.kml',
    badge: 'No Altitude',
  },
  {
    id: 'multi-leg',
    name: 'SFO ⇄ LAX Roundtrip',
    description: 'Multiple placemark tracks in one file to test multi-route selection.',
    path: '/samples/flight-multi-track.kml',
    badge: 'Multi-Leg',
  },
];


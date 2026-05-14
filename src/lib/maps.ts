// Maps data with real UUIDs and asset URLs from valorant-api.com

export interface ValorantMap {
  id: string;         // UUID from Riot
  name: string;
  competitive: boolean;
  displayIcon: string | null;    // Minimap outline
  splash: string;                // Full splash art
  listViewIcon: string;          // List thumbnail
  listViewIconTall: string;      // Tall thumbnail
  premierBackground: string | null;
  mapUrl: string;                // Internal game path (used by Riot API match data)
  tacticalDescription: string | null;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
}

export const MAPS: ValorantMap[] = [
  {
    id: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319',
    name: 'Ascent',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Ascent/Ascent',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7e-05, yMultiplier: -7e-05, xScalarToAdd: 0.813895, yScalarToAdd: 0.573242,
  },
  {
    id: 'd960549e-485c-e861-8d71-aa9d1aed12a2',
    name: 'Split',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Bonsai/Bonsai',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7.8e-05, yMultiplier: -7.8e-05, xScalarToAdd: 0.842188, yScalarToAdd: 0.697578,
  },
  {
    id: 'b529448b-4d60-346e-e89e-00a4c527a405',
    name: 'Fracture',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Canyon/Canyon',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7.8e-05, yMultiplier: -7.8e-05, xScalarToAdd: 0.556952, yScalarToAdd: 1.155886,
  },
  {
    id: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba',
    name: 'Bind',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Duality/Duality',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 5.9e-05, yMultiplier: -5.9e-05, xScalarToAdd: 0.576941, yScalarToAdd: 0.967566,
  },
  {
    id: '2fb9a4fd-47b8-4e7d-a969-74b4046ebd53',
    name: 'Breeze',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Foxtrot/Foxtrot',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7e-05, yMultiplier: -7e-05, xScalarToAdd: 0.465123, yScalarToAdd: 0.833078,
  },
  {
    id: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9',
    name: 'Lotus',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Jam/Jam',
    tacticalDescription: 'A/B/C Sites',
    xMultiplier: 7.2e-05, yMultiplier: -7.2e-05, xScalarToAdd: 0.454789, yScalarToAdd: 0.917752,
  },
  {
    id: 'fd267378-4d1d-484f-ff52-77821ed10dc2',
    name: 'Pearl',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Pitt/Pitt',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7.8e-05, yMultiplier: -7.8e-05, xScalarToAdd: 0.480469, yScalarToAdd: 0.916016,
  },
  {
    id: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047',
    name: 'Haven',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Triad/Triad',
    tacticalDescription: 'A/B/C Sites',
    xMultiplier: 7.5e-05, yMultiplier: -7.5e-05, xScalarToAdd: 1.09345, yScalarToAdd: 0.642728,
  },
  {
    id: 'e2ad5c54-4114-a870-9641-8ea21279579a',
    name: 'Icebox',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Port/Port',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7.2e-05, yMultiplier: -7.2e-05, xScalarToAdd: 0.460214, yScalarToAdd: 0.304687,
  },
  {
    id: '92584fbe-486a-b1b2-9faa-39b0f486b498',
    name: 'Sunset',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Juliett/Juliett',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7.8e-05, yMultiplier: -7.8e-05, xScalarToAdd: 0.5, yScalarToAdd: 0.515625,
  },
  {
    id: '224b0a95-48b9-f703-1bd8-67aca101a61f',
    name: 'Abyss',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Infinity/Infinity',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 8.1e-05, yMultiplier: -8.1e-05, xScalarToAdd: 0.5, yScalarToAdd: 0.5,
  },
  {
    id: '1c18ab1f-420d-0d8b-71d0-77ad3c439115',
    name: 'Corrode',
    competitive: true,
    displayIcon: 'https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/displayicon.png',
    splash: 'https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/splash.png',
    listViewIcon: 'https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/listviewicon.png',
    listViewIconTall: 'https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/listviewicontall.png',
    premierBackground: 'https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/premierbackgroundimage.png',
    mapUrl: '/Game/Maps/Rook/Rook',
    tacticalDescription: 'A/B Sites',
    xMultiplier: 7e-05, yMultiplier: -7e-05, xScalarToAdd: 0.526158, yScalarToAdd: 0.5,
  },
];

/** Find a map by its Riot mapUrl (as returned in match data) */
export function findMapByUrl(mapUrl: string): ValorantMap | undefined {
  return MAPS.find((m) => m.mapUrl === mapUrl);
}

/** Find a map by UUID */
export function findMapById(id: string): ValorantMap | undefined {
  return MAPS.find((m) => m.id === id);
}

/** Only competitive maps */
export function getCompetitiveMaps(): ValorantMap[] {
  return MAPS.filter((m) => m.competitive);
}

export const ROLE_COLORS: Record<string, string> = {
  duelist: '#FF4655',
  initiator: '#00D4AA',
  controller: '#A855F7',
  sentinel: '#3B82F6',
};

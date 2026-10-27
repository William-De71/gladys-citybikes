// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface
// (appareil / Gerät / dispositivo, scène / Szene / escena) and of bike
// sharing (station, vélo, VAE / E-Bike, place libre / freier Platz). The names
// of networks and stations stay as the operators write them.
//
// A key with an `_one` twin uses it when `n` is 1 ("1 bike", "2 bikes").
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  stationDeviceName: {
    en: '{station} ({network})',
    fr: '{station} ({network})',
    de: '{station} ({network})',
    es: '{station} ({network})',
  },
  featureBikes: {
    en: 'Available bikes',
    fr: 'Vélos disponibles',
    de: 'Verfügbare Räder',
    es: 'Bicicletas disponibles',
  },
  featureEbikes: {
    en: 'Available e-bikes',
    fr: 'Vélos électriques disponibles',
    de: 'Verfügbare E-Bikes',
    es: 'Bicicletas eléctricas disponibles',
  },
  featureMechanical: {
    en: 'Available mechanical bikes',
    fr: 'Vélos mécaniques disponibles',
    de: 'Verfügbare normale Räder',
    es: 'Bicicletas mecánicas disponibles',
  },
  featureDocks: {
    en: 'Free docks',
    fr: 'Places libres',
    de: 'Freie Stellplätze',
    es: 'Anclajes libres',
  },

  // counts
  countBikes: { en: '{n} bikes', fr: '{n} vélos', de: '{n} Räder', es: '{n} bicis' },
  countBikes_one: { en: '1 bike', fr: '1 vélo', de: '1 Rad', es: '1 bici' },
  countEbikes: {
    en: '{n} e-bikes',
    fr: '{n} électriques',
    de: '{n} E-Bikes',
    es: '{n} eléctricas',
  },
  countEbikes_one: { en: '1 e-bike', fr: '1 électrique', de: '1 E-Bike', es: '1 eléctrica' },
  countDocks: {
    en: '{n} free docks',
    fr: '{n} places',
    de: '{n} freie Plätze',
    es: '{n} anclajes',
  },
  countDocks_one: { en: '1 free dock', fr: '1 place', de: '1 freier Platz', es: '1 anclaje' },
  listLine: {
    en: '• {name}: {counts}',
    fr: '• {name} : {counts}',
    de: '• {name}: {counts}',
    es: '• {name}: {counts}',
  },
  closed: { en: 'Closed', fr: 'Fermée', de: 'Geschlossen', es: 'Cerrada' },

  // scene summaries
  summaryStation: {
    en: '{station}: {counts}.',
    fr: '{station} : {counts}.',
    de: '{station}: {counts}.',
    es: '{station}: {counts}.',
  },
  summaryClosed: {
    en: '{station} is closed.',
    fr: 'La station {station} est fermée.',
    de: 'Die Station {station} ist geschlossen.',
    es: 'La estación {station} está cerrada.',
  },
  summaryMissing: {
    en: '{station} is no longer listed by the network.',
    fr: 'La station {station} n’est plus listée par le réseau.',
    de: 'Die Station {station} wird vom Netz nicht mehr aufgeführt.',
    es: 'La estación {station} ya no figura en la red.',
  },
  findSummary: {
    en: '{sentence} {distance} away.',
    fr: '{sentence} À {distance}.',
    de: '{sentence} {distance} entfernt.',
    es: '{sentence} A {distance}.',
  },
  findNone_bike: {
    en: 'No station with a bike nearby.',
    fr: 'Aucune station avec un vélo à proximité.',
    de: 'Keine Station mit einem Rad in der Nähe.',
    es: 'Ninguna estación con bicicleta cerca.',
  },
  findNone_ebike: {
    en: 'No station with an e-bike nearby.',
    fr: 'Aucune station avec un vélo électrique à proximité.',
    de: 'Keine Station mit einem E-Bike in der Nähe.',
    es: 'Ninguna estación con bicicleta eléctrica cerca.',
  },
  findNone_dock: {
    en: 'No station with a free dock nearby.',
    fr: 'Aucune station avec une place libre à proximité.',
    de: 'Keine Station mit einem freien Platz in der Nähe.',
    es: 'Ninguna estación con anclaje libre cerca.',
  },

  // widgets
  credit: {
    en: 'Data: CityBikes (citybik.es) · {time}',
    fr: 'Données : CityBikes (citybik.es) · {time}',
    de: 'Daten: CityBikes (citybik.es) · {time}',
    es: 'Datos: CityBikes (citybik.es) · {time}',
  },
  tileBikes: { en: 'Bikes', fr: 'Vélos', de: 'Räder', es: 'Bicis' },
  tileEbikes: { en: 'E-bikes', fr: 'Électriques', de: 'E-Bikes', es: 'Eléctricas' },
  tileDocks: { en: 'Free docks', fr: 'Places', de: 'Freie Plätze', es: 'Anclajes' },
  stateLabel: { en: 'State', fr: 'État', de: 'Zustand', es: 'Estado' },
  stationMissing: {
    en: 'No longer listed',
    fr: 'Plus listée',
    de: 'Nicht mehr gelistet',
    es: 'Ya no figura',
  },
  nearbyHeading: {
    en: 'Near home · {network}',
    fr: 'Près de chez vous · {network}',
    de: 'In der Nähe · {network}',
    es: 'Cerca de casa · {network}',
  },
  widgetNoStation: {
    en: 'No station is followed: fill in the stations in the configuration of the integration, then add their devices in the Discover tab.',
    fr: 'Aucune station suivie : renseignez les stations dans la configuration de l’intégration, puis ajoutez leurs appareils dans l’onglet Découvrir.',
    de: 'Keine Station verfolgt: Trage die Stationen in der Konfiguration der Integration ein und füge dann ihre Geräte im Tab Entdecken hinzu.',
    es: 'Ninguna estación seguida: indica las estaciones en la configuración de la integración y añade sus dispositivos en la pestaña Descubrir.',
  },
  widgetNoNearby: {
    en: 'No station of the network is located.',
    fr: 'Aucune station du réseau n’est localisée.',
    de: 'Keine Station des Netzes hat einen Standort.',
    es: 'Ninguna estación de la red está localizada.',
  },
  widgetNoNetwork: {
    en: 'No bike sharing network is chosen: fill in the network in the configuration of the integration.',
    fr: 'Aucun réseau de vélos en libre-service n’est choisi : renseignez le réseau dans la configuration de l’intégration.',
    de: 'Kein Leihradnetz gewählt: Trage das Netz in der Konfiguration der Integration ein.',
    es: 'No se ha elegido ninguna red de bicicletas compartidas: indica la red en la configuración de la integración.',
  },
  widgetNoHouse: {
    en: 'The house has no location: set it in Gladys (Settings → Houses) and allow the integration to read it.',
    fr: 'La maison n’a pas de position : définissez-la dans Gladys (Paramètres → Maisons) et autorisez l’intégration à la lire.',
    de: 'Das Haus hat keinen Standort: Lege ihn in Gladys fest (Einstellungen → Häuser) und erlaube der Integration, ihn zu lesen.',
    es: 'La casa no tiene ubicación: defínela en Gladys (Ajustes → Casas) y permite que la integración la lea.',
  },

  // errors and status
  errorQuota: {
    en: 'The CityBikes API refuses more requests this hour (300 per hour and per address). It answers again within the hour.',
    fr: 'L’API CityBikes refuse d’autres requêtes pour cette heure (300 par heure et par adresse). Elle répond de nouveau dans l’heure.',
    de: 'Die CityBikes-API lehnt in dieser Stunde weitere Anfragen ab (300 pro Stunde und Adresse). Sie antwortet innerhalb der Stunde wieder.',
    es: 'La API de CityBikes rechaza más peticiones esta hora (300 por hora y por dirección). Vuelve a responder dentro de la hora.',
  },
  errorUnreachable: {
    en: 'CityBikes cannot be reached ({detail}). The integration tries again on its own.',
    fr: 'CityBikes est injoignable ({detail}). L’intégration réessaie d’elle-même.',
    de: 'CityBikes ist nicht erreichbar ({detail}). Die Integration versucht es selbst erneut.',
    es: 'No se puede contactar con CityBikes ({detail}). La integración lo vuelve a intentar sola.',
  },
  statusQuota: {
    en: 'Hourly quota of the CityBikes API reached: the readings start again within the hour.',
    fr: 'Quota horaire de l’API CityBikes atteint : les lectures reprennent dans l’heure.',
    de: 'Stundenkontingent der CityBikes-API erreicht: Die Abfragen starten innerhalb der Stunde wieder.',
    es: 'Cuota horaria de la API de CityBikes alcanzada: las lecturas se reanudan dentro de la hora.',
  },
  statusUnknownNetwork: {
    en: 'CityBikes knows no network “{network}”: press “Find a network” to get its id.',
    fr: 'CityBikes ne connaît aucun réseau « {network} » : appuyez sur « Chercher un réseau » pour obtenir son identifiant.',
    de: 'CityBikes kennt kein Netz „{network}“: Drücke „Netz suchen“, um seine Kennung zu erhalten.',
    es: 'CityBikes no conoce ninguna red «{network}»: pulsa «Buscar una red» para obtener su identificador.',
  },
  statusAmbiguousNetwork: {
    en: 'Several networks match “{network}”: {ids}. Type one of these ids in the “Network” field.',
    fr: 'Plusieurs réseaux correspondent à « {network} » : {ids}. Saisissez l’un de ces identifiants dans le champ « Réseau ».',
    de: 'Mehrere Netze passen zu „{network}“: {ids}. Trage eine dieser Kennungen in das Feld „Netz“ ein.',
    es: 'Varias redes coinciden con «{network}»: {ids}. Escribe uno de estos identificadores en el campo «Red».',
  },
  statusNoNetwork: {
    en: 'Choose a bike sharing network: type it in the configuration, or set the location of the house to use the nearest one.',
    fr: 'Choisissez un réseau de vélos en libre-service : saisissez-le dans la configuration, ou définissez la position de la maison pour prendre le plus proche.',
    de: 'Wähle ein Leihradnetz: Trage es in der Konfiguration ein oder lege den Standort des Hauses fest, um das nächste zu nehmen.',
    es: 'Elige una red de bicicletas compartidas: escríbela en la configuración o define la ubicación de la casa para usar la más cercana.',
  },
  statusNoNearNetwork: {
    en: 'No bike sharing network is known near the house: type one in the configuration.',
    fr: 'Aucun réseau de vélos en libre-service n’est connu près de la maison : saisissez-en un dans la configuration.',
    de: 'In der Nähe des Hauses ist kein Leihradnetz bekannt: Trage eines in der Konfiguration ein.',
    es: 'No se conoce ninguna red de bicicletas compartidas cerca de la casa: escribe una en la configuración.',
  },
  statusConnected: {
    en: '{network}: {count} station(s) followed, read every {minutes} min.',
    fr: '{network} : {count} station(s) suivie(s), lue(s) toutes les {minutes} min.',
    de: '{network}: {count} Station(en) verfolgt, alle {minutes} Min. gelesen.',
    es: '{network}: {count} estación(es) seguida(s), leída(s) cada {minutes} min.',
  },
  statusNotFound: {
    en: 'Not found: {names}.',
    fr: 'Introuvable : {names}.',
    de: 'Nicht gefunden: {names}.',
    es: 'No encontrado: {names}.',
  },

  // actions of the Configuration screen
  testError: {
    en: 'Test failed: {error}',
    fr: 'Échec du test : {error}',
    de: 'Test fehlgeschlagen: {error}',
    es: 'Prueba fallida: {error}',
  },
  testNetworks: {
    en: 'CityBikes answers ({count} networks).',
    fr: 'CityBikes répond ({count} réseaux).',
    de: 'CityBikes antwortet ({count} Netze).',
    es: 'CityBikes responde ({count} redes).',
  },
  testOk: {
    en: 'Network {network}: {stations} stations, {count} followed (house: {house}).',
    fr: 'Réseau {network} : {stations} stations, {count} suivie(s) (maison : {house}).',
    de: 'Netz {network}: {stations} Stationen, {count} verfolgt (Haus: {house}).',
    es: 'Red {network}: {stations} estaciones, {count} seguida(s) (casa: {house}).',
  },
  noHouse: {
    en: 'none located',
    fr: 'aucune localisée',
    de: 'keines mit Standort',
    es: 'ninguna localizada',
  },
  searchTooShort: {
    en: 'Type at least two characters.',
    fr: 'Saisissez au moins deux caractères.',
    de: 'Gib mindestens zwei Zeichen ein.',
    es: 'Escribe al menos dos caracteres.',
  },
  searchNone: {
    en: 'Nothing matches “{query}”.',
    fr: 'Rien ne correspond à « {query} ».',
    de: 'Nichts passt zu „{query}“.',
    es: 'Nada coincide con «{query}».',
  },
  searchNetworkEmpty: {
    en: 'Type a city, a network or an operator (“Paris”, “velib”, “nextbike”).',
    fr: 'Saisissez une ville, un réseau ou un opérateur (« Paris », « velib », « nextbike »).',
    de: 'Gib eine Stadt, ein Netz oder einen Betreiber ein („Paris“, „velib“, „nextbike“).',
    es: 'Escribe una ciudad, una red o un operador («Paris», «velib», «nextbike»).',
  },
  searchNetworkFound: {
    en: '{count} network(s), copy the id into the “Network” field:\n{list}',
    fr: '{count} réseau(x), copiez l’identifiant dans le champ « Réseau » :\n{list}',
    de: '{count} Netz(e), kopiere die Kennung in das Feld „Netz“:\n{list}',
    es: '{count} red(es), copia el identificador en el campo «Red»:\n{list}',
  },
  searchStationFound: {
    en: '{network}: {count} station(s), copy the id into the “Stations” field:\n{list}',
    fr: '{network} : {count} station(s), copiez l’identifiant dans le champ « Stations » :\n{list}',
    de: '{network}: {count} Station(en), kopiere die Kennung in das Feld „Stationen“:\n{list}',
    es: '{network}: {count} estación(es), copia el identificador en el campo «Estaciones»:\n{list}',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the logs of the integration ({count} line(s) “CityBikes diagnostic”).',
    fr: 'Diagnostic écrit dans les journaux de l’intégration ({count} ligne(s) « CityBikes diagnostic »).',
    de: 'Diagnose in die Protokolle der Integration geschrieben ({count} Zeile(n) „CityBikes diagnostic“).',
    es: 'Diagnóstico escrito en los registros de la integración ({count} línea(s) «CityBikes diagnostic»).',
  },
};

/**
 * @description Whether a value is a supported language.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, its placeholders filled.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The placeholder values.
 * @returns {string} The text.
 * @example
 * t('countBikes', 'fr', { n: 3 }); // -> '3 vélos'
 */
function t(key, language, values = {}) {
  const entry = (values.n === 1 && TEXTS[`${key}_one`]) || TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string} key - A TEXTS key.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

export { LANGUAGES, TEXTS, isLanguage, t, all };

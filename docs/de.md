# CityBikes

## Überblick

Diese Integration bringt die **Leihrad-Stationen** deiner Stadt in Gladys: die **verfügbaren Räder**, die **E-Bikes**, die **normalen Räder** und die **freien Stellplätze** der Stationen, die du verfolgst, für mehr als 800 Netze weltweit — Vélib' in Paris, Vélo'v in Lyon, Bicing in Barcelona, die nextbike-Netze (Berlin, Leipzig…), WienMobil Rad, Santander Cycles in London… Jede Station wird zu einem Gerät, das du auf einem Dashboard anzeigen und in Szenen nutzen kannst: Lass dich benachrichtigen, wenn ein Rad an die Station vor deinem Fenster zurückkommt, oder finde vor Feierabend den nächsten freien Stellplatz.

Die Daten stammen aus der **CityBikes-API** (https://citybik.es), einem kostenlosen Projekt, das die Daten der Betreiber bündelt: kein Konto, kein Schlüssel. Das ganze Netz wird standardmäßig alle 2 Minuten mit einer einzigen Anfrage gelesen, unabhängig von der Zahl der verfolgten Stationen. Die Nutzungsbedingungen der API verlangen eine Quellenangabe: Die Widgets zeigen „Daten: CityBikes (citybik.es)“.

Es ist eine **Cloud**-Integration: Sie kontaktiert `api.citybik.es`. Der Standort deines Hauses wird nur innerhalb der Integration verwendet, um das nächste Netz und die nächsten Stationen zu finden: Er wird nie an CityBikes gesendet.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Für die Stationen beim Haus: ein Standort für das Haus (Einstellungen → Häuser) und die bei der Installation der Integration akzeptierte Standortberechtigung. Ohne sie trägst du Netz und Stationen selbst ein.

## Konfiguration

| Feld                  | Was eintragen                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Netz                  | Die CityBikes-Kennung des Netzes („velib“, „nextbike-berlin“), sein Name oder seine Stadt. Leer: das Netz, das dem Haus am nächsten ist.               |
| Haus                  | Das Haus, von dem aus das nächste Netz und die nächsten Stationen gesucht werden. Leer: das erste Haus mit Standort.                                   |
| Verfolgte Stationen   | Bis zu 20, durch Kommas getrennt: ihre Kennungen („22002“) oder genauen Namen. Die Schaltfläche **Station suchen** liefert die Kennungen.              |
| Stationen beim Haus   | Keine, oder die 1, 2, 3 (Standard) oder 5 nächsten Stationen, verfolgt ohne Eintippen.                                                                 |
| Abfrage der Stationen | Alle 1, 2 (Standard), 5 oder 10 Minuten. Eine Anfrage pro Abfrage; die API erlaubt 300 pro Stunde.                                                     |
| Sprache der Texte     | Namen der Funktionen, Szenen-Zusammenfassungen und -Ausgaben. Automatisch: die Sprache deines Dashboards, sobald ein CityBikes-Widget angezeigt wurde. |

Die Schaltflächen unter dem Formular:

- **Verbindung testen**: liest die Liste der Netze neu, dann dein Netz und deine Stationen, und zeigt, was gefunden wurde.
- **Netz suchen**: Gib eine Stadt, ein Netz oder einen Betreiber ein („Berlin“, „Wien“, „nextbike“); leer listet sie die Netze, die dem Haus am nächsten sind. Kopiere die Kennung in das Feld **Netz**.
- **Station suchen**: Gib Wörter des Namens oder der Adresse ein („Alexanderplatz“); sie liefert die Kennung jeder Station mit ihren aktuellen Rädern. Kopiere die Kennungen in **Verfolgte Stationen**.
- **Diagnose**: schreibt das Netz, die Stationen, die letzte Abfrage, den letzten Fehler und das restliche Kontingent in den Tab Protokolle, für eine Meldung.

## Verwendung

### Geräte

Öffne nach dem Speichern den Tab **Entdecken** der Integration und lege die gewünschten Stationen an. Jede heißt „Station (Netz)“ und enthält, wenn der Betreiber sie liefert:

- **Verfügbare Räder**: alle Arten von Rädern;
- **Verfügbare E-Bikes** und **Verfügbare normale Räder** (Vélib', Vélo'v, Bicing…);
- **Freie Stellplätze**: um ein Rad zurückzugeben (fehlt bei manchen stationslosen Netzen).

Die Werte folgen den Abfragen der Integration; Gladys speichert ihren Verlauf.

### Dashboard-Widgets

- **Leihrad-Stationen**: die Stationen, die du hinzugefügt hast (oder die in seinen Einstellungen gewählten); eine Station als drei Kacheln, mehrere als Liste mit einem farbigen Badge der verbleibenden Räder.
- **Räder in der Nähe**: die 1 bis 8 Stationen, die dem Haus am nächsten sind, mit ihrer Entfernung, auf Wunsch nur die mit einem Rad, einem E-Bike oder einem freien Platz.

![Das Widget Leihrad-Stationen mit vier Vélib'-Stationen, dann mit einer, und das Widget Räder in der Nähe (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-citybikes/main/docs/assets/widgets.de.png)

### Szenen

Auslöser, für eine Station oder jede verfolgte Station: **wieder Räder verfügbar**, **Station leer**, **wieder E-Bikes verfügbar**, **kein E-Bike mehr**, **wieder freie Plätze**, **Station voll**. Ihre Variablen liefern die Station, das Netz, die Räder, E-Bikes, normalen Räder und freien Plätze (-1, wenn der Betreiber sie nicht zählt).

Aktionen: **Station lesen** (ihre Zähler und ein Satz für eine Nachricht) und **nächste Station finden** mit einem Rad, einem E-Bike oder einem freien Platz, vom Haus oder von einer verfolgten Station aus (Name, Entfernung in Metern, Zähler, Satz).

Beispiele:

- Wenn „Station leer“ für die Station vor deinem Fenster auslöst, werktags zwischen 7:00 und 8:30 → „Kein Rad mehr unten, versuch die Station am Platz“ an dein Handy senden.
- Wenn „Wieder E-Bikes verfügbar“ auslöst → es über den Lautsprecher im Flur ansagen.
- Um 18:00 → „nächste Station finden“ mit freiem Platz von der Station deines Büros aus → ihre Zusammenfassung senden.

### Transport

Nur Cloud: Der Katalog zeigt das Cloud-Badge, es gibt keine lokale Verbindung. Die Integration fragt `api.citybik.es` einmal pro Woche nach der Liste der Netze und bei jeder Abfrage nach deinem Netz. Die Koordinaten des Hauses verlassen nie Gladys und die Integration.

## Fehlerbehebung

- **„CityBikes kennt kein Netz …“**: Nutze **Netz suchen** und kopiere die Kennung genau („nextbike-berlin“, nicht „Nextbike Berlin“).
- **Eine Station ist „Nicht gefunden“**: Ihr Name ist mehrdeutig oder anders geschrieben; nutze **Station suchen** und trage ihre Kennung ein.
- **„Stundenkontingent der CityBikes-API erreicht“**: Die API erlaubt 300 Anfragen pro Stunde und Adresse, geteilt mit allem anderen auf deiner Verbindung; wähle eine seltenere Abfrage. Die Abfragen starten von selbst wieder.
- **Kein Gerät unter Entdecken**: Kein Netz oder keine Station wurde gefunden; sieh dir den Status der Integration an und drücke **Verbindung testen**.
- **Die Zähler wirken alt**: Manche Betreiber aktualisieren ihre Daten nur alle paar Minuten; die Widgets zeigen die Uhrzeit der letzten Abfrage.
- Für eine Meldung drücke **Diagnose** und hänge die Zeilen „CityBikes diagnostic“ aus dem Tab Protokolle an, mit den Versionen von Gladys und der Integration.

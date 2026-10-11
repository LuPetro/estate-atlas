# Umsetzungs- und Prüfstatus

Stand: 11. Oktober 2026 (Europe/Vienna). Projekt: `/home/codexdev/projects/estate-atlas`.

## Meilensteine

| Meilenstein            | Tatsächlicher Stand                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 · Projektgrundlage   | Monorepo, projektlokale Node-/pnpm-Werkzeuge, beide Apps, gemeinsame Modelle/Client, PostgreSQL, Architektur, AGENTS.md und lokales Git eingerichtet.                                                                                                                                                                                                                                |
| 2 · Benutzbare Version | Web-Dashboard und native Screens für Dashboard, Liste, Details, CRUD, Archiv und Karte implementiert; private Foto-/PDF-Anhänge und datierte Wertangaben; beide Clients verwenden dieselbe persistente REST-API. Adresssuche und Pin-Auswahl in beiden Editoren ergänzt. Web tatsächlich im Browser geprüft. Native JS-Builds für beide Plattformen geprüft; Gerätetests noch offen. |
| 3 · Benutzerkonten     | Echte Registrierung, Login, Logout, scrypt, HttpOnly-Web-Cookies, native Bearer-/SecureStore-Sitzungen, Ablauf und strikte Eigentümerprüfungen umgesetzt und gegen PostgreSQL getestet. E-Mail-Verifizierung, Passwort-Reset und MFA sind noch nicht implementiert.                                                                                                                  |
| 4 · KI-Analyse | OpenAI-Responses-Adapter, austauschbare Modelle, persistente Docker-Worker-Queue, echte Phasen/Abbruch, gemeinsame Vergleichspreisregeln, Quellen/Evidenz/Unsicherheiten, ausdrücklich bestätigte Wertübernahme und Tageslimits implementiert. Eigentümer hat GPT-6 Luna mit zunächst einem Auftrag pro 24 Stunden freigegeben. Key fehlt; noch kein kostenpflichtiger Live-Test. |

## Ausgeführte Prüfungen

| Prüfung             | Ergebnis                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typprüfung          | shared, api-client, api, mobile und web erfolgreich.                                                                                                                                                                                                                                     |
| Geschäftsregeln/API | **95 Tests bestanden**: 32 bisherige API-Tests, 11 neue Analyse-/Worker-/Eigentümer-/Limit-Tests gegen echtes PostgreSQL, 7 Provider-Vertragstests ohne externe Aufrufe, 15 Vergleichspreisregeln, 8 Geocoder-Grenzfälle, 17 Geschäftsregeln, 3 Laufzeitkonfigurationen und 2 Geometrieprüfungen.                                                                                        |
| Browser             | **18 Fälle bestanden**, je neun auf Desktop und Smartphone-Breite, gegen einen separaten Next-Standalone-Produktionsbuild. Auth, CRUD, Archiv, private Dateien, Ansichten, Adressauswahl/Pin/GPS, Kartenmodi/CARTO-Ausfall, Recherche mit gekennzeichneten synthetischen Quellen, Wertübernahme, Abbruch und fehlender Konfiguration.                             |
| Produktionsbuilds   | API-ESM inklusive separatem Migrationsprogramm und Next-Produktionsbuild erfolgreich.                                                                                                                                                                                                    |
| API-Laufzeitpaket   | Tatsächlich mit Produktionsabhängigkeiten deployt und gegen isoliertes PostgreSQL gestartet: Migrationen, Healthcheck, Registrierung, lokale Web-Cookies und Schutz privater Routen bestanden.                                                                                           |
| Native              | Android-/iOS-Hermes-Exporte erfolgreich, ca. 3,2–3,3 MB je Plattform mit lokaler SVG-Karte und nativen Straßenkarten. Expo-SDK-57-Abhängigkeiten geprüft. Keine Gerätetests/APK/IPA.                                                                                                         |
| Docker              | Beide Images im tatsächlichen Docker-Daemon gebaut; DB/API/Web gestartet und gesund. Web/API laufen als Benutzer node; DB-Rolle ohne Superuserrechte. Neustart geprüft, alle sieben Tabellenzahlen weiterhin identisch zum Backup.                                                       |
| Übernahme           | Konsistentes privates Backup; Tabellenzahlen und vollständige Zeilenfingerprints aller sieben Tabellen stimmen mit der Quelle überein, einschließlich Dateien und Sitzungen.                                                                                                             |
| Aktuelle Server-App | Chromium erreicht Docker-Web/API, Anmeldeformular und CORS; HTTP 401 ohne Anmeldung ist erwartet. Keine Daten in der normalen Datenbank angelegt.                                                                                                                                        |
| Kartenansicht       | Auf 1440/390 px gegen den tatsächlichen Docker-Web-Build geprüft: 177 lokale Länderflächen, keine Standardkacheln, echte OSM-Kacheln erst im Detailmodus, Rückkehr zur Übersicht mit erhaltenem Pin und ohne Browserfehler. Gekennzeichnete Browser-Fixtures, keine Datenbankänderungen. |

Tests verwenden getrennte PostgreSQL-Cluster auf 55433/55434/55435/55436, Browserdienste auf 3001/4001 und einen separaten `.next-e2e`-Build. Testadressen werden nicht an Photon gesendet. Kartenprovider-Fixtures sind synthetisch; visuelle Detailprüfungen verwenden echte OSM-Kacheln. Private Zugangsdaten, Sicherungen und Screenshots bleiben ignoriert.

## Tatsächlicher Betrieb

Docker Compose ist jetzt Standard und auf diesem VPS aktiv: Web `127.0.0.1:3000`, API `127.0.0.1:4000`, PostgreSQL nur im Compose-Netzwerk. Der bisherige SSH-Tunnel funktioniert weiter. Optimierte Produktionsartefakte erlauben ausdrücklich nur für den exakten localhost-Origin HTTP-Cookies; öffentlicher Betrieb erfordert HTTPS und Abschalten dieser Ausnahme.

Die Docker-Gruppenfreigabe wurde ausdrücklich autorisiert und vom Eigentümer ausgeführt. Die laufende Agent-Sitzung verwendet `sg docker`; neue Login-Sitzungen erhalten die Gruppe regulär. Die alten Host-Web-/API-/PostgreSQL-Prozesse sind gestoppt. Ursprüngliche `.env`, Datenbankverzeichnis und privater Dump bleiben unverändert für eine Wiederherstellung erhalten. Containerneustarts, Healthchecks, Logrotation und ein benanntes Datenvolume sind konfiguriert. Bedienung und Importverfahren stehen in docs/docker.md.

## Grenzen und nächste Schritte

- Native Karten-/Pin-Gesten und visuelle Abnahme auf echten Android-/iOS-Geräten stehen aus. JS-Exporte ersetzen keine signierten Store-Builds. Android SDK, JDK und Xcode sind auf dem VPS nicht eingerichtet.
- Öffentlichen HTTPS-Betrieb, regelmäßige Backups/Wiederherstellungsproben, Monitoring und Upload-Quoten/Scanning vorbereiten.
- Kontoverwaltung, E-Mail-Verifizierung, Passwort-Reset und Adminrollen fehlen noch; E-Mail-Anbieter/Domain wurden auf Wunsch verschoben.
- OpenAI-Anbindung wartet noch auf den Key und einen echten App-Auftrag. Kostenfreigabe für GPT-6 Luna mit global/persönlich einem Auftrag pro 24 Stunden liegt vor. Qualitätsprüfung echter Quellen/Preise und fachliche Abnahme bleiben offen; ohne ausreichend Daten gibt es keinen geschätzten Wert.
- Weitere GitHub-Pushes benötigen ausdrückliche Freigabe; der private erste Push ist abgeschlossen. Lokale Änderungen werden lokal committet.


## Recherche-Update und VPS-Neustart (11.10.2026)

Der Eigentümer hat den VPS nach einem Ausfall neu gestartet. Änderungen und Daten blieben erhalten; DB/API/Web waren danach gesund. Ursache ist nicht durch Kernelprotokolle belegt. Image-Build und Prüfungen hatten sich auf dem 1,8-GB-Host ohne Swap überlappt. Seitdem werden umfangreiche Prüfungen einzeln ausgeführt; der Docker-Wrapper serialisiert beide Images auch bei `up --build`. Projektlokaler Node-Standardheap ist 384 MB; native Exporte verwenden einen Metro-Worker. Keine globalen Speicher-/Swap-/Systemeinstellungen wurden verändert.

Typprüfung und 95 Tests nach Neustart bestanden; Android/iOS jeweils ca. 3,3 MB exportiert. API und Web einzeln erfolgreich als Docker-Images gebaut. Vor Migration 002 entstand ein neuer privater pg_dump; alle sechs bisherigen Daten-Tabellen haben unveränderte Zeilenzahlen. DB, API, Web und neuer Worker sind gesund. Keine neuen Benutzer/Immobilien in der normalen Datenbank. API-/Worker-Key-Datei ist leer; OpenAI wurde nicht aufgerufen. Die freigegebene Einzeltest-Konfiguration liegt nur in ignorierter `.local/docker/compose.env`. Zugang und Ablauf stehen in docs/ai-research.md.

# EstateAtlas

Private Immobilienportfolios auf **Next.js Web (zusätzlich als PWA installierbar)** und **nativen Expo / React-Native-Apps für Android und iOS**, verbunden mit einer gemeinsamen Fastify-REST-API und echtem PostgreSQL. Die PWA ersetzt die native App nicht.

Projekt auf diesem VPS: `/home/codexdev/projects/estate-atlas`.

## Was implementiert ist

- Echte Registrierung, Anmeldung und Abmeldung; scrypt-Passworthashes, ablaufende/revozierbare Sitzungen, Web-Cookies und native SecureStore-Tokens.
- Private Benutzerportfolios mit geprüften Eigentümerrechten für Immobilien, Fotos, Dokumente und Analyseaufträge.
- Anlegen, Bearbeiten, Archivieren, Wiederherstellen und endgültiges Löschen.
- Adresse, ISO-Land, GPS, Art, Kaufpreis, eigener Marktwert, Währung, Fläche, Baujahr, Zustand, Ausstattung und Notizen.
- Filterbares Dashboard mit pro Konto auf dem Gerät gespeicherten, einzeln ausblendbaren Bereichen. Eigener Portfolio-Werte-Tab mit Objektverläufen, Zeitraum, Sortierung und Archivfilter; Summen je Währung. Keine erfundenen historischen Entwicklungen oder Wechselkurse.
- Geführter Portfolio-Einstieg, CSV- und Excel-Import mit Vorschau (bis 50 Objekte) und klaren Datenprüfungen, Wiedervorlagen pro Immobilie und lokal erstellbarer PDF-Bericht. Excel liest das erste Tabellenblatt; Adressen werden nicht automatisch geokodiert. Berichte lassen Adressen standardmäßig weg.
- Vermietungsstatus, Mietbeginn und Mietende oder unbefristeter Vertrag in Web und nativer App.
- Web: responsive Übersicht, Kachel-, Listen- und Tabellenansicht, Suche und Filter, Leaflet-Weltkarte mit Clustering.
- Native Apps: Stack- und Tab-Navigation, Übersicht, Liste, Details, Formular und native Weltkarte mit Clustering und Filtern.
- Private Foto-/PDF-Uploads (JPEG, PNG, WebP, PDF; 10 MB; bis 30 Anhänge pro Immobilie).
- Opt-in-Testdaten im angemeldeten Benutzerportfolio, überall als synthetisch gekennzeichnet.
- KI-Recherche mit OpenAI-Adapter, austauschbaren Modellen, eigener Docker-Worker-Queue, nachvollziehbarer Vergleichspreisberechnung, Quellen und ausdrücklicher Wertübernahme. Standardmäßig bis Key und Kostenfreigabe deaktiviert; Einrichtung in [docs/ai-research.md](docs/ai-research.md).

## Mit Docker auf dem VPS starten

Docker Compose ist der Standard für Web, API und PostgreSQL. Bei einem neuen Checkout zunächst `./scripts/bootstrap.sh` ausführen, falls die projektlokalen Prüfwerkzeuge benötigt werden. Docker und Compose müssen auf dem Host verfügbar und für den ausführenden Benutzer zugänglich sein.

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/docker config --quiet
./scripts/docker up -d --build --wait
./scripts/docker ps
```

Auch `./scripts/pnpm dev` startet diesen Stack. Die API führt beim Start Migrationen aus; Healthchecks warten auf Datenbank und API. Zugangsdaten entstehen einmalig unter `.local/docker/`; vorhandene `.env`-Dateien bleiben erhalten. PostgreSQL speichert seine Daten in einem benannten Volume. `./scripts/docker down` erhält dieses Volume.

**Bestehende Host-Daten zuerst übernehmen:** Vor dem ersten Start von API/Web die Anleitung in [docs/docker.md](docs/docker.md) verwenden. Sie erstellt ein konsistentes Backup, importiert in eine leere Docker-Datenbank und vergleicht die Tabellen. Die ursprüngliche Datenbank bleibt erhalten. Nicht einfach eine leere Container-App über das bestehende Portfolio starten.

Auf diesem Server laufen Web, API und PostgreSQL jetzt als gesunde Docker-Container. Die bestehende Datenbank wurde nach einem privaten Backup übernommen; Zeilenzahlen und vollständige Zeilenfingerprints aller sieben Anwendungstabellen stimmen überein. Die bisherigen Host-Prozesse sind gestoppt. Die ursprüngliche Datenbank bleibt unverändert als Rückfallmöglichkeit erhalten.

Die Ports bleiben:

- Web: [http://localhost:3000](http://localhost:3000)
- Datenbank-Healthcheck: [http://localhost:4000/health](http://localhost:4000/health)

Im Web ein eigenes Konto erstellen. Es gibt keine voreingestellten Konten oder Passwörter. Danach eine Immobilie anlegen oder ausdrücklich **Testdaten laden** wählen. Beim Anlegen oder Bearbeiten die Adresse eingeben und einen Vorschlag auswählen: Adresse, ISO-Land und GPS werden automatisch übernommen. Die Position lässt sich durch Kartenklick oder Ziehen des Pins korrigieren; manuelle GPS-Eingabe bleibt möglich. Änderungen am Adresstext verwerfen die alte Position, damit keine Koordinaten einer anderen Adresse gespeichert werden. Dasselbe Verhalten ist in der nativen App implementiert.

Adressvorschläge verwenden [Photon mit OpenStreetMap-Daten](https://github.com/komoot/photon). Nur aktiv eingegebene Suchtexte werden über die authentifizierte API an den Dienst gesendet; keine vorhandenen Immobilien werden automatisch abgefragt. Name, Kontodaten, Werte und Dokumente werden nicht an Photon gesendet. Die App zeigt den Hinweis und die OSM-Attribution im Formular. Vorschläge können Straßen- oder Ortsmittelpunkte sein: Position prüfen und gegebenenfalls den Pin verschieben. Bei fehlenden Treffern oder Dienstausfall kann die Position weiterhin auf der Karte gesetzt werden.

Der öffentliche Photon-Demodienst ist für moderate Anfragen freigegeben, ohne Verfügbarkeitsgarantie. Die API begrenzt Aufrufe und hält einen kleinen Cache pro Konto ausschließlich im Arbeitsspeicher. Über `GEOCODING_URL` lässt sich eine eigene Photon-kompatible Instanz konfigurieren; für größeren Betrieb ist ein geeigneter Dienst festzulegen. Es ist kein API-Key und kein kostenpflichtiger Dienst eingerichtet.

Browser-Origin ist exakt `http://localhost:3000`; nicht zwischen `localhost` und `127.0.0.1` wechseln.

**Vom eigenen Rechner zum VPS:** Einen bestehenden SSH-Zugang mit einem temporären lokalen Tunnel verwenden. Das ändert weder SSH-Konfiguration noch Firewall:

```bash
ssh -N -L 3000:127.0.0.1:3000 -L 4000:127.0.0.1:4000 codexdev@DEIN_VPS
```

Danach auf deinem Rechner `http://localhost:3000` öffnen. `DEIN_VPS` durch den vorhandenen Host ersetzen. Die Dienste sind bewusst nicht öffentlich an `0.0.0.0` gebunden. Die Adresssuche sendet den eingegebenen Suchtext an Photon; du kannst stattdessen den Pin oder die GPS-Felder nutzen. Dokumentdateien bleiben in der privaten Projektdatenbank. Die vereinfachte Standardkarte lädt lokale Länderflächen. Erst „Details anzeigen“ lädt externe Kartenkacheln; der Anbieter sieht IP und Kartenausschnitt. Web-Schriftarten werden lokal mitgeliefert.

### Direkt auf dem VPS prüfen

Während der Compose-Stack läuft, in einem weiteren Server-Terminal:

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/pnpm web:check
```

Der projektlokale Chromium startet ohne grafische Oberfläche. Die Prüfung lädt die tatsächliche laufende Web-App, prüft das Anmeldeformular und die API-Verbindung aus dem Browser inklusive CORS. Ohne Anmeldung ist `401` bei `/auth/me` korrekt; `/health` muss `200` liefern. Es werden keine Benutzer oder Immobilien angelegt. Dies ist eine Verbindungsprüfung, kein vollständiger Portfolio-Test.

Für einen schnellen API-Test genügt `curl -sS http://localhost:4000/health`. Erwartet wird `{"status":"ok","service":"EstateAtlas API"}`.

Wenn diese Server-Prüfung besteht, aber der eigene Browser „Keine Verbindung zur API“ meldet, im selben Browser `http://localhost:4000/health` öffnen. Der SSH-Tunnel muss **beide** Ports 3000 und 4000 weiterleiten und auf dem eigenen Rechner laufen. Die Web-App unter exakt `http://localhost:3000` öffnen. `localhost` im Browser bezeichnet den Rechner mit diesem Browser; die direkte VPS-IP ist mit der aktuellen Loopback-Konfiguration kein Web-Zugang.

## Auf dem iPhone und nativ testen

Die private Web-Version benötigt auf dem iPhone dieselben zwei SSH-Weiterleitungen wie am PC: lokale Ports 3000 und 4000 auf `127.0.0.1:3000` / `127.0.0.1:4000` des VPS. Danach Safari unter `http://localhost:3000` öffnen. Der vollständige Ablauf und die Voraussetzungen für eine signierte native App stehen in [docs/mobile-testing.md](docs/mobile-testing.md).

Die native React-Native-App ist ein eigenes Deliverable. Der JavaScript-Export erzeugt keine installierbare IPA/APK. Für iPhone-TestFlight fehlen derzeit Apple-/Expo-Signierung und eine erreichbare HTTPS-API. Expo-Go-Kompatibilität mit dem eingesetzten SDK 57 muss vor einem Gerätetest geprüft werden.

Eine optionale Metro-Vorschau läuft ebenfalls in Docker, nicht auf dem Host:

```bash
./scripts/pnpm dev:mobile
./scripts/docker --profile mobile logs --tail=50 mobile
./scripts/docker --profile mobile stop mobile
```

Der Metro-Port bleibt unter `127.0.0.1:8081` privat. Das Profil wird beim normalen Start nicht gestartet. Nach Quellcodeänderungen `dev:mobile` erneut aufrufen; das Vorschaubild enthält den Stand beim Build. Keine bezahlten Cloud-Builds oder öffentlichen Tunnel werden dabei angelegt.

## Kartenstil

Web und native App zeigen standardmäßig eine vereinfachte Weltkarte: helle Flächen, reduzierte Ländergrenzen, eigene Pins und Cluster. Die generalisierten [Natural-Earth-Länderflächen](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) liegen im Projekt, sind gemeinfrei und benötigen keinen Schlüssel oder externen Kacheldienst. Quellen und Verarbeitung stehen in `packages/shared/src/world-countries-source.md`. Diese Übersicht dient der Orientierung; auf Straßenebene wird bewusst in die Detailkarte gewechselt.

**„Details anzeigen“** aktiviert Straßenkarten. **„Vereinfacht anzeigen“** kehrt zur Übersicht zurück. Immobilien, Filter und GPS-Werte bleiben erhalten. Im Adresseditor fokussiert die Detailkarte den gewählten Pin; dort kann er präzise verschoben werden. Im Web passt „Übersicht“ die Karte auf alle gefilterten Immobilien ein. Native Übersichten unterstützen Verschieben, Pinch-Zoom und Zoomtasten; Geräteprüfung bleibt erforderlich.

Webdetails verwenden OpenStreetMap, optional CARTO Positron mit `NEXT_PUBLIC_CARTO_MAPS_KEY` in `.local/docker/compose.env`. Nur einen öffentlichen, auf die Website beschränkten Basemaps-Key von [CARTO](https://www.carto.com/basemaps/) verwenden und Web danach neu bauen. Bei CARTO-Ausfall erfolgt ein Hinweis und Wechsel auf OSM mit korrekter Attribution. Es ist kein Kartenkonto oder kostenpflichtiger Tarif eingerichtet.

Native Details verwenden Apple Maps auf iOS (`mutedStandard`) und einen hellen Google-Maps-Stil auf Android. Der Standard ist auf beiden Plattformen dieselbe lokale SVG-Übersicht. Ein eigenständiger Android-Build benötigt weiterhin einen beschränkten Google-Maps-Key für die Detailkarte.

Browserprüfungen verwenden synthetische CARTO-Kacheln und prüfen den OSM-Rückfall, die vereinfachte Ansicht ohne Kacheln sowie unveränderte Pins/GPS beim Umschalten. Testdaten bleiben in isolierten Testdatenbanken.

## Prüfungen

```bash
./scripts/pnpm typecheck
./scripts/pnpm test
./scripts/pnpm build
./scripts/pnpm mobile:export
./scripts/pnpm exec playwright install chromium
./scripts/pnpm test:e2e
```

Bei einem minimalen **Ubuntu 24.04 x64** ohne Chromium-Bibliotheken: `./scripts/browser-deps.sh` lädt die benötigten Debian-Pakete herunter und extrahiert sie ausschließlich nach `.local/sysroot`; keine Systeminstallation. `scripts/pnpm` setzt den lokalen Bibliothekspfad automatisch. Auf anderen Systemen vorhandene Browser-Abhängigkeiten verwenden.

API-Tests starten einen isolierten echten PostgreSQL-Cluster auf `127.0.0.1:55433`. `test:e2e` erstellt einen eigenen Webpack-Build unter `.next-e2e` und startet API/Web auf 4001/3001 sowie PostgreSQL auf 55434. Die Entwicklungsdienste auf 3000/4000 können weiterlaufen. Desktop und Smartphone-Bildschirmgröße werden nacheinander mit frischen Testservern geprüft, damit Testregistrierungen nicht die echte Registrierungsbegrenzung aufbrauchen. Geocoder-Antworten sind synthetische Fixtures; keine Testadressen werden an Photon gesendet. Die normale Benutzerdatenbank wird von den Tests nicht geleert oder benutzt. Testcluster werden anschließend entfernt. Screenshots und Traces bleiben ignoriert unter `work/` bzw. `test-results/`.

`mobile:export` erzeugt Android- und iOS-Hermes-Bundles unter `apps/mobile/dist`. Das prüft den vollständigen JavaScript-Build, **keine installierbare APK/IPA und keinen Gerätetest**. Native Compiler/Simulatoren sind auf diesem VPS nicht installiert. CI ist vorbereitet; ihren Laufstatus separat auf GitHub prüfen.

Im isolierten Browser-Testrunner teilen alle Fälle eine Loopback-IP und verwenden deshalb ein höheres globales Anfragelimit. Die echte API behält 240 Anfragen/Minute; ein Fixture-Override ist im öffentlichen Produktionsmodus verboten und dieser Schutz wird gegen PostgreSQL geprüft. Registrierung, Sicherheit und Recherche behalten ihre eigenen Grenzen.

## GitHub

Lokales Git und das private Repository [LuPetro/estate-atlas](https://github.com/LuPetro/estate-atlas) sind verbunden; der freigegebene erste Push ist erfolgt. GitHub CLI liegt unter `.local/gh` und ist über `./scripts/gh` erreichbar. Details stehen in `docs/github.md`. Weitere Pushes benötigen deine ausdrückliche Freigabe. Zugangsdaten gehören niemals in den Chat oder ins Repository.

## Struktur und nächste Schritte

```text
apps/web               Next.js Web-App
apps/mobile            Native Expo / React-Native-App
apps/api               Fastify REST, SQL-Migrationen, Berechtigungstests
packages/shared        Zod-Modelle, Filter, Clustering, Portfolio-Regeln
packages/api-client    Gemeinsamer Web-/Native-HTTP-Client
docs                   Architektur, GitHub, Status und Prüfungen
scripts                Projektlokale Tools, Datenbank, Builds und Testserver
```

Architekturentscheidungen: `docs/architecture.md`. Arbeitsregeln: `AGENTS.md`. Konkreter Prüfstatus: `docs/status.md`.

Portfolio-Werte und anpassbare Dashboard-Bereiche: [docs/portfolio-workspace.md](docs/portfolio-workspace.md).

Die technische Vorbereitung für V1-Web ist in [docs/web-launch.md](docs/web-launch.md) beschrieben: Docker-HTTPS-Edge mit gemeinsamem `/api`, sichere PWA, Betrieb/Überwachung, Speichergrenzen und Produktionsprüfung. Vor öffentlichem Start fehlen Domain/DNS, reale SMTP-Zustellung, Betreibertexte, Admin-E-Mail/2FA und externe Sicherung/Überwachung. `./scripts/pnpm release:check` listet die tatsächlich fehlenden Einstellungen auf. Danach folgen native Geräte-/Storetests; Kosten- und Cashflowplanung bleiben mögliche Erweiterungen.

## Konten und Verwaltung

Kontoeinstellungen: Sidebar **Mein Konto** oder `/account`; native App: **Mein Konto & Sicherheit**. Adminpanel: `/admin`, nur mit Verwaltungsrolle und Zwei-Faktor-Sitzung. Docker nutzt standardmäßig Einladungen für neue Konten und erstellt tägliche lokale Backups. Erstes Admin-Konto, Mailanbieter, Secret-Konfiguration und Wiederherstellungstest: [Konten und Adminbetrieb](docs/accounts-admin.md).

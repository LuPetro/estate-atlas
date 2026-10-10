# EstateAtlas

Private Immobilienportfolios auf **Next.js Web** und **nativen Expo / React-Native-Apps für Android und iOS**, verbunden mit einer gemeinsamen Fastify-REST-API und echtem PostgreSQL. Keine PWA.

Projekt auf diesem VPS: `/home/codexdev/projects/estate-atlas`.

## Was implementiert ist

- Echte Registrierung, Anmeldung und Abmeldung; scrypt-Passworthashes, ablaufende/revozierbare Sitzungen, Web-Cookies und native SecureStore-Tokens.
- Private Benutzerportfolios mit geprüften Eigentümerrechten für Immobilien, Fotos, Dokumente und Analyseaufträge.
- Anlegen, Bearbeiten, Archivieren, Wiederherstellen und endgültiges Löschen.
- Adresse, ISO-Land, GPS, Art, Kaufpreis, eigener Marktwert, Währung, Fläche, Baujahr, Zustand, Ausstattung und Notizen.
- Dashboard mit Statistiken und getrennten Währungssummen. Datierte Wertänderungen in der Detailansicht; keine erfundenen historischen Entwicklungen oder Wechselkurse.
- Web: responsive Übersicht, Kachel-, Listen- und Tabellenansicht, Suche und Filter, Leaflet-Weltkarte mit Clustering.
- Native Apps: Stack- und Tab-Navigation, Übersicht, Liste, Details, Formular und native Weltkarte mit Clustering und Filtern.
- Private Foto-/PDF-Uploads (JPEG, PNG, WebP, PDF; 10 MB; bis 30 Anhänge pro Immobilie).
- Opt-in-Testdaten im angemeldeten Benutzerportfolio, überall als synthetisch gekennzeichnet.
- Persistente, ausdrücklich **blockierte** Analyseaufträge als Grundlage für Meilenstein 4. Keine echte Recherche, kein KI-Anbieter, keine generierten Bewertungen.

## Lokal auf dem VPS starten

Die Werkzeuge sind bereits lokal installiert. Bei einem neuen Checkout zunächst `./scripts/bootstrap.sh` ausführen. Alle Werkzeuge, Caches, PostgreSQL-Dateien und Zugangsdaten bleiben in ignorierten Projektdateien; keine Installation als Root, keine Docker-Gruppe und keine globalen Konfigurationsänderungen erforderlich.

**Terminal 1 – Datenbank:**

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/pnpm db:start
```

Beim ersten Start erzeugt das Skript eine `.env` mit zufälligem Datenbankpasswort (Dateirechte 0600), initialisiert PostgreSQL und bindet ausschließlich `127.0.0.1:55432`. `Ctrl+C` stoppt den Server und erhält die Daten. Bei bereits laufender Projektdatenbank beendet sich das Skript mit einer entsprechenden Meldung. `.env` nicht durch die Beispieldatei überschreiben.

**Terminal 2 – API und Web:**

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/pnpm dev
```

Das Skript führt Migrationen aus und startet API und Next.js. Auf demselben Rechner:

- Web: [http://localhost:3000](http://localhost:3000)
- Datenbank-Healthcheck: [http://localhost:4000/health](http://localhost:4000/health)

Im Web ein eigenes Konto erstellen. Es gibt keine voreingestellten Konten oder Passwörter. Danach eine Immobilie anlegen oder ausdrücklich **Testdaten laden** wählen. Browser-Origin ist exakt `http://localhost:3000`; nicht zwischen `localhost` und `127.0.0.1` wechseln.

**Vom eigenen Rechner zum VPS:** Einen bestehenden SSH-Zugang mit einem temporären lokalen Tunnel verwenden. Das ändert weder SSH-Konfiguration noch Firewall:

```bash
ssh -N -L 3000:127.0.0.1:3000 -L 4000:127.0.0.1:4000 codexdev@DEIN_VPS
```

Danach auf deinem Rechner `http://localhost:3000` öffnen. `DEIN_VPS` durch den vorhandenen Host ersetzen. Die Dienste sind bewusst nicht öffentlich an `0.0.0.0` gebunden. Keine private Adresse oder Dokumentdatei muss für diesen Test an einen Drittanbieter hochgeladen werden. Kartenkacheln kommen direkt von OpenStreetMap; der Anbieter sieht IP und Kartenausschnitt. Web-Schriftarten werden von Google Fonts geladen; Systemschriften dienen als Fallback.

### Direkt auf dem VPS prüfen

Während Datenbank und `dev` laufen, in einem weiteren Server-Terminal:

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/pnpm web:check
```

Der projektlokale Chromium startet ohne grafische Oberfläche. Die Prüfung lädt die tatsächliche laufende Web-App, prüft das Anmeldeformular und die API-Verbindung aus dem Browser inklusive CORS. Ohne Anmeldung ist `401` bei `/auth/me` korrekt; `/health` muss `200` liefern. Es werden keine Benutzer oder Immobilien angelegt. Dies ist eine Verbindungsprüfung, kein vollständiger Portfolio-Test.

Für einen schnellen API-Test genügt `curl -sS http://localhost:4000/health`. Erwartet wird `{"status":"ok","service":"EstateAtlas API"}`.

Wenn diese Server-Prüfung besteht, aber der eigene Browser „Keine Verbindung zur API“ meldet, im selben Browser `http://localhost:4000/health` öffnen. Der SSH-Tunnel muss **beide** Ports 3000 und 4000 weiterleiten und auf dem eigenen Rechner laufen. Die Web-App unter exakt `http://localhost:3000` öffnen. `localhost` im Browser bezeichnet den Rechner mit diesem Browser; die direkte VPS-IP ist mit der aktuellen Loopback-Konfiguration kein Web-Zugang.

## Native Mobile-App ausprobieren

Die App rendert native React-Native-Komponenten und native Karten; ein Browser mit Smartphone-Bildschirmgröße ist nur ein Web-Responsivitätstest.

### Android mit Expo Go und USB (VPS ohne Android SDK)

1. Eine zu Expo SDK 57 passende Expo-Go-Version auf einem Android-Gerät installieren. USB-Debugging aktivieren und das Gerät am eigenen Rechner anschließen; `adb` dort bereitstellen.
2. Auf dem VPS in Terminal 3:

   ```bash
   cd /home/codexdev/projects/estate-atlas
   ./scripts/pnpm dev:mobile
   ```

3. Auf dem eigenen Rechner API und Metro über den bestehenden SSH-Zugang weiterleiten:

   ```bash
   ssh -N -L 4000:127.0.0.1:4000 -L 8081:127.0.0.1:8081 codexdev@DEIN_VPS
   ```

   Wenn bereits ein Tunnel für Port 4000 besteht, nur Port 8081 zusätzlich weiterleiten.

4. Auf dem eigenen Rechner:

   ```bash
   adb reverse tcp:4000 tcp:4000
   adb reverse tcp:8081 tcp:8081
   adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8081
   ```

5. In der nativen App mit demselben Konto wie im Web anmelden. Das Gerät erreicht die API unter dem Standardwert `http://localhost:4000`; Bearbeitungen landen in derselben VPS-Datenbank.

### iOS oder lokaler Android-Entwicklungsrechner

Den Quellcode auf den eigenen Rechner übernehmen, z. B. über das lokale Git-Bundle in `work/estate-atlas.bundle` (ohne `.env`, Datenbank oder Tokens). macOS/Linux benötigen Node 22.13+ und pnpm 10.34.6; das Bootstrap-Skript installiert beide projektlokal. Für einen iOS-Simulator muss Xcode auf einem Mac bereits vorhanden sein.

```bash
# Auf dem eigenen Rechner; Host anpassen:
scp codexdev@DEIN_VPS:/home/codexdev/projects/estate-atlas/work/estate-atlas.bundle ./estate-atlas.bundle
git clone estate-atlas.bundle estate-atlas
cd estate-atlas
./scripts/bootstrap.sh
```

Eine eigene lokale `.env` mit `EXPO_PUBLIC_API_URL=http://localhost:4000` anlegen und die VPS-API per SSH-Port 4000 weiterleiten. Dann `./scripts/pnpm dev:mobile` und in der Expo-Konsole `i` für den iOS-Simulator verwenden. Der Simulator nutzt denselben API-Tunnel; es muss keine zweite Datenbank angelegt werden.

Ein **physisches iPhone** braucht eine API-Adresse, die vom Telefon erreichbar ist. Dafür vor dem Gerätetest einen privaten HTTPS-/VPN-Zugang abstimmen und `EXPO_PUBLIC_API_URL` entsprechend setzen; `localhost` des Telefons bezeichnet nicht den VPS. Es wurden keine Firewall-/SSH-Änderungen oder öffentlichen Tunnel eingerichtet.

Ein eigenständiger Android-Build benötigt vor Veröffentlichung einen freigegebenen Google-Maps-Key mit App-/API-Beschränkungen. iOS verwendet Apple Maps. Store-Signierung, Entwicklerkonten und ggf. notwendige Dienste werden erst nach Freigabe eingerichtet. Die konkrete Expo-/Native-Kompatibilität ist über `expo install --check` geprüft. Auf einem Linux-VPS ohne Desktop nutzt der Wrapper Expo im Headless-Modus, damit keine grafischen React-Native-DevTools installiert oder gestartet werden. Das native App-Bundling bleibt aktiv.

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

API-Tests starten einen isolierten echten PostgreSQL-Cluster auf `127.0.0.1:55433`. Browser-Tests starten einen separaten PostgreSQL-Cluster auf Port 55434 sowie API/Web auf 4000/3000. Vor `test:e2e` Entwicklungsserver auf 3000/4000 stoppen; zuerst den Web-Build erstellen. Die normale Benutzerdatenbank wird von den Tests nicht geleert oder benutzt. Testcluster werden anschließend entfernt. Screenshots und Traces bleiben ignoriert unter `work/` bzw. `test-results/`.

`mobile:export` erzeugt Android- und iOS-Hermes-Bundles unter `apps/mobile/dist`. Das prüft den vollständigen JavaScript-Build, **keine installierbare APK/IPA und keinen Gerätetest**. Native Compiler/Simulatoren sind auf diesem VPS nicht installiert. CI ist vorbereitet; ohne GitHub-Push wurde sie noch nicht auf GitHub ausgeführt.

## GitHub

Lokales Git ist eingerichtet, GitHub CLI liegt unter `.local/gh` und ist über `./scripts/gh` erreichbar. Details und die einmalige Anmeldung stehen in `docs/github.md`. Repository-Erstellung und Push benötigen deine ausdrückliche Freigabe. Zugangsdaten gehören niemals in den Chat oder ins Repository.

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

Als Nächstes: Android-/iOS-Gerätetests und native Build-Konfiguration, bestätigter privater HTTPS-Betrieb mit Backups sowie E-Mail-Verifizierung/Passwort-Reset. Für Meilenstein 4 zulässige Marktquellen auswählen und notwendige API-Zugänge freigeben; danach Worker, reale Vergleichsobjekte, Quellen, Unsicherheiten und begründete Preisspannen implementieren.

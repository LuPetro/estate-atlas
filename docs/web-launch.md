# EstateAtlas V1 · Web-Veröffentlichung

> Dev/Prod deployment update: see [development-deployment.md](development-deployment.md). Dev has a separate protected preview pipeline; Prod promotes only a successfully tested Dev commit/image pair. Production configuration now lives under `.local/environments/production/`, selected with `EA_ENVIRONMENT=production`. The `.local/docker/` paths below describe the earlier single-stack setup.

Die V1 ist eine Web-App für private Immobilienportfolios mit optionaler Installation als PWA. Die native Expo-App bleibt bestehen und wird weiterhin für Android/iOS exportiert. Die PWA ersetzt weder die native App noch deren spätere Geräte-/Storeabnahme.

## Was für die Veröffentlichung vorbereitet ist

- Docker-HTTPS-Edge (Caddy), automatische Zertifikate, HTTP→HTTPS, eine kanonische Domain; Web und API unter derselben Adresse, API-Pfad `/api`. Die App braucht öffentlich keinen zweiten Port und keinen SSH-Tunnel.
- Sichere Web-Cookies, geprüfter Origin/CSRF-Schutz, genau ein vertrauenswürdiger Proxy-Hop; Caddy überschreibt vom Internet gelieferte Forwarding-Header. Dadurch bleiben IP-basierte Limits hinter dem Proxy wirksam.
- Bestehende Konten, E-Mail-Verifizierung, Wiederherstellung, Einladungen, 2FA, Sitzungsverwaltung, Kontoexport/-löschung, Admin-/Supportrollen und Audit. Kein automatischer Zugriff der Verwaltung auf private Objektinhalte.
- Antworten laufender Portfolio-Anfragen sind an die aktuelle Sitzung gebunden. Logout/Kontowechsel verwirft alte Antworten, Such-/Filter- und Detailzustände; ein verzögerter Response kann kein vorheriges Portfolio in das neue Konto zurückschreiben. Web prüft das mit zwei echten synthetischen Konten in der isolierten Testdatenbank; native Listen nutzen dieselbe Sitzungsabgrenzung.
- Manifest, lokale PNG-Icons einschließlich Apple-Touch-/Maskable-Icon, Installationsseite, Offline-Hinweis. Der Service Worker speichert ausschließlich `/offline.html` und `/offline.css`: keine Portfolios, Dateien, API-Antworten, App-Seiten oder Mailcodes. Kein Offline-Bearbeiten/Sync und keine Push-Benachrichtigungen in V1.
- Lokale, lizenzierte DM-Sans-/Manrope-Schriftarten; keine Google-Fonts-Verbindung mehr. Mobile Formulare mit 16px, Safe-Area-Abstände, reduzierte Animationen entsprechend Geräteeinstellung.
- Sicherheitsheader/CSP, Hilfe/Kontakt, Impressum, Datenschutz, Nutzungshinweise und öffentlich erreichbarer Konto-Löschablauf. Betreibertexte werden als Text gerendert, nicht als fremdes HTML.
- Grenzen standardmäßig 100 Immobilien pro Eigentümer einschließlich Archiv, 250 MB Dokumente pro Eigentümer, 2 GB Dokumente insgesamt, 30 Dateien/Objekt und 10 MB/Datei. Collaborator-Uploads werden dem Eigentümer zugerechnet; Eigentumsübertragung prüft den Empfänger. Neue Reservierungen sind gegen konkurrierende Aufrufe geschützt. Vorhandene Daten werden bei Überschreitung nie automatisch gelöscht.
- Höchstens zwei gleichzeitige Datenexporte, begrenzte Passwortberechnungen, Ratenlimits und API-Verbindungszeitlimit ohne automatische Wiederholung.
- Tägliche lokale DB-Backups und isolierte Restore-Probe; zusätzlich verschlüsselbarer Wiederherstellungskoffer inklusive MFA-Schlüssel. Eine externe Kopie ist für diesen ersten privaten V1-Start bewusst zurückgestellt; sie schützt bei Verlust des VPS und sollte vor dem Ausbau ergänzt werden.
- Docker `maintenance`: abgelaufene Sitzungen/Linkcodes sofort beim täglichen Durchlauf, abgelaufene Einladungen nach zusätzlichen 30 Tagen, Recherche-Limitreservierungen nach zwei Tagen, unbestätigte 2FA-Einrichtung nach einer Stunde, Audit nach standardmäßig 180 Tagen. Immobilien, Dateien und Rechercheergebnisse werden dabei nicht gelöscht.
- Docker `monitor`: API/Web/Recherche-Worker alle 60 Sekunden und Backup-Alter (26 Stunden), optional Mailwarnung bei Zustandsänderung, höchstens tägliche Erinnerung bei weiter bestehender Störung, auch bei Versandfehlern. Keine privaten Inhalte in Warnungen oder Zugriffslogs. `GET /api/health` ist der öffentliche Verfügbarkeitscheck und wird beim Live-Preflight geprüft. Ein Monitor im selben VPS erkennt keinen kompletten VPS-/Netzausfall; ein externer HTTPS-Monitor bleibt für später empfohlen.

## Die verbleibenden externen Einstellungen

1. **Domain und DNS:** Domain kaufen, kanonischen App-Host festlegen (z. B. `app.deine-domain.tld`), A-Record zur VPS-Adresse setzen. AAAA nur setzen, wenn IPv6 tatsächlich erreichbar ist. Ports 80/443 müssen über die vorhandene Anbieter-/Firewallkonfiguration erreichbar sein. Keine Host-, SSH- oder Firewalländerung wird von den Projektskripten durchgeführt.
2. **E-Mail:** SMTP-Anbieter auswählen; Absenderdomain beim Anbieter bestätigen, dessen DNS-Anforderungen einschließlich SPF/DKIM und gewünschter DMARC-Regel einrichten. Zugang und Passwort eintragen. Reale Zustellung von Verifizierung und Reset im eigenen Postfach testen. Mailpit ist dafür kein Ersatz.
3. **Betreiberinformationen:** `.local/environments/production/docker/site.json` enthält vorbereitete Textentwürfe. Betreiber, ladungsfähige Anschrift, Support-/Datenschutzkontakt und tatsächlichen IONOS-Rechenzentrumsstandort prüfen/ergänzen; danach Texte persönlich prüfen und erst dann `reviewed: true` setzen. Die technische Beschreibung in der App ergänzt diese Texte; sie ist keine Zusicherung rechtlicher Vollständigkeit. Aufbewahrungsangaben müssen zu DB-Backups, externen Kopien, Audit, Mail-/KI-/Kartenanbietern passen. Eine bloße Stadt kann für die Impressumspflicht eines gehosteten Dienstes unzureichend sein; vor Veröffentlichung rechtlich klären, falls keine private Anschrift angegeben werden soll.
4. **Admin:** Eigenes Passwort setzen, E-Mail bestätigen und 2FA unter „Mein Konto“ einrichten, Wiederherstellungscodes privat aufbewahren. Kein neuer Benutzer wird automatisch Admin. Aktive Admins mit bestätigter E-Mail und 2FA sind Startvoraussetzung.
5. **Sicherung:** Lokale tägliche Sicherung und isolierte Wiederherstellungsprobe sind im Preflight verpflichtend. Eine externe Kopie ist vorerst zurückgestellt und schützt später vor VPS-Verlust.
6. **Überwachung:** `https://deine-domain/api/health` ist der Health-Check. Der Docker-Monitor prüft zusätzlich API, Web, Worker und lokale Backups. Ein externer HTTPS-Monitor kann später denselben Endpunkt abfragen und auch einen vollständigen VPS-Ausfall melden.

Keine Anbieter wurden gebucht, Domain registriert oder öffentlichen Ports aktiviert. Bestehende lokale Schlüssel und Portfoliodaten bleiben erhalten.

## GitHub-Deployment mit Freigabe

`dev` und `main` haben eigene Pipelines. Pushes auf `dev` veröffentlichen nach erfolgreichen Prüfungen automatisch die private Dev-Vorschau. Pushes auf `main` führen die Main-Prüfungen aus. Für Produktion bleibt die bewusste Freigabe über **Actions → EstateAtlas Main pipeline → Run workflow → main → production_approval=deploy** erforderlich.

Alle gemeinsamen Checks müssen tatsächlich erfolgreich sein; übersprungene oder fehlgeschlagene Jobs genügen nicht. Der neueste Push-Lauf für den freizugebenden Main-Commit muss grün sein. Zusätzlich muss exakt derselbe vollständige Quellstand bereits einen erfolgreichen Dev-Lauf samt HTTPS-Prüfung besitzen. Merge- und Squash-Commits sind möglich, solange ihr Quellbaum mit dem geprüften Dev-Commit übereinstimmt. Produktion übernimmt dessen unveränderliche Docker-Images. Die Autorisierung läuft in einem eigenen Job ohne Produktions-Secrets. Details und Branch-Regeln stehen in [development-deployment.md](development-deployment.md).

Das GitHub Environment `production` ist angelegt, um Deployment-Einstellungen getrennt von den allgemeinen Repository-Secrets zu halten. Vor dem ersten echten Deployment dort einrichten:

1. Variablen `DEPLOY_SSH_HOST` (VPS-IP oder Hostname), `DEPLOY_SSH_USER` (`codexdev`), `DEPLOY_SSH_PORT` (`22`), `DEPLOY_PATH` (`/home/codexdev/projects/estate-atlas`) und `DEPLOY_SSH_KNOWN_HOSTS` setzen. Der letzte Wert muss den vorher über einen vertrauenswürdigen Admin-Kanal bestätigten SSH-Hostschlüssel enthalten. Nicht ungeprüft die Ausgabe von `ssh-keyscan` übernehmen.
2. Als Environment-Secret `DEPLOY_SSH_PRIVATE_KEY` einen dedizierten Deployment-Schlüssel ohne interaktive Passphrase hinterlegen; die Geheimhaltung übernimmt das GitHub-Secret. Ein passwortgeschützter Schlüssel wird ohne Rückfrage abgelehnt. Der öffentliche Schlüssel wird ausschließlich dem VPS-Benutzer zugeordnet. Kein privater Schlüssel oder VPS-Passwort in Git, Workflowdatei oder Chat speichern.
3. Dem VPS-Checkout muss bereits ein read-only GitHub-Zugang zum privaten Repository zur Verfügung stehen. Der Workflow verwendet diesen Zugang für `git fetch`; er überträgt den Deployment-Schlüssel nicht nach GitHub und legt keine neuen GitHub-Zugangsdaten auf dem VPS ab.

Der VPS prüft den aktuellen Remote-`main` und verwendet ein unveränderliches Quellarchiv unter `.local/releases/<commit>`. Der gemeinsame Arbeitsordner darf auf `dev` oder einem Feature-Branch bleiben; lokale Änderungen und unveröffentlichte Arbeit werden nicht überschrieben. `.local/deploy/lock` verhindert gleichzeitige Server-Deployments. Vor den Containern werden Produktionskonfiguration und Dev-Image-Nachweis geprüft, danach die echten HTTPS-Endpunkte. `.local/deploy/last-release.json` dokumentiert Release, vorherigen Checkout-Commit, Phase und Ergebnis. Ein fehlgeschlagener Deploy bedeutet keinen automatischen Rollback. SSH prüft den Hostschlüssel strikt; private Schlüssel bleiben im temporären Runner-Verzeichnis und werden aufgeräumt. Der Serverprozess ist auf 28 Minuten begrenzt.

`./scripts/check-workflows` prüft die GitHub-Workflowdefinitionen mit actionlint 1.7.12 (offizielles Release, SHA-256 festgelegt) und die Shell-Syntax. Die vollständige CI führt außerdem die isolierten Deployment-Regressionstests aus: neuere fehlgeschlagene CI-Läufe, übersprungene Jobs, Git-Konflikte, unveröffentlichte Arbeit, parallele Starts und Fehler vor/nach dem Containerstart. Diese Tests verwenden synthetische lokale Git-Repositories und SSH-/Docker-Stubs, keine Live-Daten oder echten Deployments.

## Einrichtung in der richtigen Reihenfolge

Alle Befehle im Repository ausführen; bei veralteter Gruppensitzung `sg docker -c '…'` verwenden.

1. Domain/Anbieter einrichten. `config/production.env.example` beschreibt die Werte für `.local/docker/compose.env`. **Nicht die vorhandene Datei blind überschreiben**: den aktuellen Key-/Modellbetrieb und die vorhandenen Portwerte bewusst übernehmen. Die Passwortdateien niemals neu generieren. `NEXT_PUBLIC_API_URL=/api` ist ein Buildwert, erfordert Web-Neubuild.
2. Zunächst den SMTP-Versand im weiterhin privaten Loopback-Setup aktivieren: `SMTP_*` ergänzen, Passwort geschützt in `.local/docker/smtp-password`, `ACCOUNT_PUBLIC_URL=http://localhost:3000` und `ALLOW_LOCAL_HTTP=true` noch beibehalten. API neu erstellen. Mailverifizierung und Passwortreset mit dem eigenen echten Postfach testen; Links funktionieren mit dem bisherigen SSH-Tunnel. Admin-Adresse bestätigen und 2FA einrichten. Nicht die Verwaltung vor dieser Vorbereitung öffentlich starten.
3. Betreiberdatei füllen. Verschlüsselten Koffer erzeugen und außerhalb des VPS sichern:

   ```bash
   ./scripts/pnpm exec node scripts/recovery-kit.mjs export
   ```

   Die Passphrase wird verborgen im interaktiven Terminal abgefragt (mindestens 20 Zeichen). Nicht im Chat senden. Ausgabe `.local/backups/export/*.eab` ist AES-256-GCM-authentifiziert; dump, MFA-Schlüssel, DB-Zugang und Betriebs-/Betreiberkonfiguration werden verschlüsselt. Provider-Keys sind nicht enthalten. Alternativ `--passphrase-file /absoluter/geschuetzter/pfad` mit Dateimodus 600. Nicht als Kommandoargument/Umgebungsvariable angeben.

   Zum Prüfen auf einem sicheren Rechner bzw. in der isolierten Projektumgebung:

   ```bash
   ./scripts/pnpm exec node scripts/recovery-kit.mjs open /absoluter/pfad/koffer.eab
   ./scripts/check-backup
   ```

   `open` authentifiziert und entschlüsselt in eine neue private TAR-Datei, überschreibt nie vorhandene Dateien und stellt niemals die Live-DB wieder her. Passwortfehler/manipulierte Archive hinterlassen keine unvollständige Klartextdatei. TAR nur in ein neues privates Verzeichnis entpacken. `check-backup` prüft den tatsächlichen Dump in einer isolierten Docker-DB und schreibt einen datierten Nachweis. Die Probe muss beim Start höchstens sieben Tage alt sein.

4. Die HTTPS-Werte aus der Vorlage aktivieren, `OPS_ALERT_EMAIL`, Speicher-/Auditgrenzen und SMTP eintragen. `SMTP_DELIVERY_CONFIRMED=true` erst nach einem echten Versandtest setzen. Externe Sicherung und externer Uptime-Monitor sind keine Startblocker; lokale Backups, Restore-Probe und der Live-Check von `/api/health` bleiben aktiv.
5. Prüfen und starten:

   ```bash
   ./scripts/pnpm release:check
   ./scripts/docker --profile public up -d --build --wait
   ./scripts/pnpm release:check --live
   ./scripts/docker ps
   ```

   Der Docker-Wrapper ruft die Prüfung auch vor `up` mit `public`/`edge` auf und baut auf dem kleinen VPS sequenziell. Caddy speichert Zertifikate in benannten Volumes. Kein CDN/DNS-Proxy ist als zusätzlicher vertrauenswürdiger Hop konfiguriert; zunächst normalen DNS-Betrieb verwenden.

6. In einem frischen Browser: Registrierung per Einladungslink/-code, E-Mail bestätigen, Anmeldung/2FA/Reset, Immobilie erstellen/bearbeiten/archivieren, Datei hoch-/herunterladen, Teilen/Rollen, Export und Kontolöschung mit einem eigenen **gekennzeichneten Testkonto** abnehmen. Keine fremden Live-Daten für Löschtests verwenden. iPhone über die HTTPS-Domain öffnen, in Safari „Teilen → Zum Home-Bildschirm“; Installation, Logout und Offline-Hinweis prüfen. Chromium im Smartphone-Viewport ersetzt die Safari-Geräteabnahme nicht.

`release:check --config-only` listet Konfigurationslücken ohne Datenbank-/Backupprüfung. Ein erfolgreiches `--config-only` ist keine Go-live-Abnahme. Die eigentliche Prüfung liest nur Metadaten; sie sendet keine kostenpflichtige Recherche oder Mail und gibt keine Secrets aus.

`./scripts/check-edge` prüft die echte Caddy-Konfiguration gegen laufende Docker-Dienste in einem kurzlebigen Container: Web/Manifest/Icons/Service Worker und `/api/health`, ohne Hostports und ohne Zertifikatsausstellung. Die spätere echte HTTPS-Prüfung mit deiner Domain bleibt erforderlich.

`./scripts/check-edge-privacy` simuliert zusätzlich eine ausgefallene API mit einer künstlichen privaten Suchzeichenfolge. Die Prüfung verlangt HTTP 502 und keine Zeichenfolge im Proxy-Log. Caddys rohe HTTP-Fehlerlogs sind ausgeschlossen, da sie trotz deaktivierter Access-Logs URLs/Queries enthalten können. API-Logs mit Routenvorlagen und der Monitor bleiben zur Diagnose aktiv. Diese Prüfung läuft auch in CI, ohne echte Backend-Daten und ohne öffentliche Ports.

## Recherche im öffentlichen Betrieb

Der aktuelle private Testerbetrieb bleibt unverändert. Vor weiteren Nutzern positive Konto-/Gesamtlimits konfigurieren (Vorlage: fünf/20 Aufträge pro Tag). Die Produktionsprüfung blockiert unbegrenzte öffentliche Recherche. Die per Auftrag erlaubten Modell-/Suchaufrufe, Zustimmung, Eigentümerprüfung und ausdrückliche Wertübernahme bleiben bestehen; keine bezahlten Wiederholungen.

Die Recherche nutzt Angebotspreise, kann an fehlenden oder widersprüchlichen Quellen scheitern und ist keine geprüfte professionelle Bewertung. Vor Aktivierung für weitere Nutzer echte Ergebnisse stichprobenartig prüfen; bei unzureichender fachlicher Abnahme `ANALYSIS_ENABLED=false` veröffentlichen. Die übrige App funktioniert dann weiterhin.

## Betrieb und Wiederherstellung

- `./scripts/docker ps`, `logs --tail=50 api worker maintenance monitor backup` kontrollieren. Kein öffentlicher Docker-Socket und keine privaten Diagnoseschnittstellen.
- Externes Monitoring sowie Backups wiederkehrend kontrollieren; Restore-Probe nach Schemaänderungen und regelmäßig ausführen. Schlüsselrotation und Kontolöschung auch bei älteren Backups/externen Kopien berücksichtigen. Nach einem Restore alte Sitzungen widerrufen und seit dem Backup erfolgte Löschungen nachführen, bevor Zugang geöffnet wird.
- Vor einem Update Backup prüfen und aktuelle Image-IDs/Release-Commit privat festhalten. Stoppen des öffentlichen Zugangs: `./scripts/docker --profile public stop edge`. `docker down -v` niemals als Update-/Rollbackbefehl verwenden.
- Rollback: Edge stoppen, zuletzt getesteten Git-Stand in separatem Checkout prüfen/bauen, vorhandene DB/Secret-Konfiguration übernehmen. Vorher prüfen, ob das Schema abwärtskompatibel ist. Kein automatisches Downgrade und keine Wiederherstellung in die Live-DB durch dieses Release.

## Native App und Abhängigkeiten

`EXPO_PUBLIC_API_URL=https://deine-domain/api` verwendet denselben Server. Native Speicheranzeige und API-Limits entsprechen Web. Eigene Android-/iOS-Builds, Deep-Link-/Upload-/Kartenprüfung, Entwicklerkonten, Signierung und Stores bleiben der nächste Meilenstein.

Die Abhängigkeitsprüfung überprüft alle Produktionsabhängigkeiten und blockiert gemeldete Web/API-Lücken. Zwei bekannte, bisher ungepatchte Advisory-IDs in privaten Expo-Werkzeugen sind gezielt dokumentiert (`node-forge` GHSA-86w9-cpqp-85rv; `braces` GHSA-vfj7-8cjw-p6xm); nur deren exakte Expo-Pfade sind ausgenommen. Sie sind nicht Bestandteil der Web-/API-Container. Neue oder anders platzierte Lücken sind nicht ausgenommen. UUID im Xcode-Werkzeug wurde kompatibel auf 11.1.1 angehoben. Mobile Vorschau bleibt Loopback-only; Expo-Tooling vor native Release erneut prüfen.

Quellen zur technischen Einrichtung: [Caddy automatisches HTTPS](https://caddyserver.com/docs/automatic-https), [Caddy Reverse Proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). Next.js/PWA-Konventionen wurden gegen die mit dem installierten Next.js 16.4 mitgelieferte Dokumentation geprüft.

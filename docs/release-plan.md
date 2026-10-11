# EstateAtlas: Vorschlag bis zur Veröffentlichung

Stand: 11. Oktober 2026 (Europe/Vienna). Dieser Plan beschreibt Empfehlungen und offene Produktentscheidungen; er genehmigt keine Anbieterbuchung, Systemänderung oder Veröffentlichung.

## Ausgangslage

Web und native Expo-Apps verwenden dieselbe Fastify-/PostgreSQL-API. Anmeldung und private Portfolios sind implementiert. Adresssuche, Kartenposition, Immobilienverwaltung und private Anhänge funktionieren. Der derzeitige PostgreSQL-Cluster und die Vordergrund-Entwicklungsprozesse sind ein Entwicklungssetup. E-Mail-Verifizierung, Passwort-Reset, Rollen, Adminpanel und Store-Gerätetests fehlen. Analyseaufträge bleiben blockiert und erzeugen keinen Marktwert; ein Research-Worker und freigegebene Datenquellen sind noch nicht eingerichtet.

## 1. Kontoverwaltung vervollständigen

- E-Mail-Verifizierung mit einmaligen, gehashten und ablaufenden Tokens; erneuter Versand begrenzt.
- Passwort-Reset mit gleichförmiger Antwort für bekannte/unbekannte E-Mail-Adressen, einmaligem Token und Sitzungswiderruf.
- Profil bearbeiten, Passwort und E-Mail ändern, Geräte-/Sitzungsübersicht, Abmelden anderer Sitzungen.
- Kontolöschung und Export eigener Daten; nachvollziehbare Behandlung zugehöriger Immobilien und Dateien.
- Ein E-Mail-Transport für Web und native App; Versand aus der API, verifizierte Absenderdomain und native Deep Links plus Web-Landingpage.
- Migrationen und echte API-/Browserprüfungen für Ablauf, Wiederverwendung, Berechtigungen und Zustellungsergebnisse.

Zu entscheiden: Absenderdomain, E-Mail-Anbieter/Zugang, Umgang mit bereits angelegten unbestätigten Konten. Ein Dienst wie Resend ist ein möglicher Kandidat; er wurde nicht eingerichtet. Domain-Verifikation: <https://resend.com/docs/dashboard/domains/introduction>.

## 2. Kleines Adminpanel

- Rollen `user` und `admin` mit serverseitigen Berechtigungen.
- Den ersten Administrator über eine ausdrücklich bestimmte Betreiberidentität provisionieren; keine automatische Adminrolle für den ersten Registrierenden.
- Kontoübersicht, Kontostatus, Sperren/Freischalten und Sitzungswiderruf.
- Versand-/Analysejobstatus, technische Fehler und Nutzungs-/Speicherquoten.
- Auditprotokoll für administrative Änderungen und MFA für Administratoren.
- Adminzugriff zunächst auf Kontometadaten und Betriebsstatus beschränken. Supportzugriff auf Portfolioinhalte ist eine gesonderte Produkt-/Berechtigungsentscheidung.

Abnahme: Ein normales Konto erreicht keine Adminfunktion; eine Sperre widerruft laufende Sitzungen; administrative Aktionen sind nachvollziehbar.

## 3. Dauerhafter Web-Betrieb und private Beta

- Domain, HTTPS und Produktionskonfiguration festlegen.
- Dauerhafte API-/Web-Prozesse und Neustartstrategie mit dem Betreiber abstimmen; SSH-Tunnel dient weiter nur der Entwicklung.
- Produktionsdatenbank, begrenzte DB-Rolle und Migrationen; Backups einschließlich erfolgreichem Wiederherstellungstest.
- Monitoring, Fehlererfassung ohne vertrauliche Inhalte, begrenzte Uploads und Abuse-Schutz.
- Privater Dateispeicher und Quoten; ein Umzug aus `bytea` in privaten Objektspeicher ist bei Bedarf separat zu entscheiden.
- Supportkontakt, Datenschutzangaben und Kontolöschungsseite vorbereiten.
- Einladungsbasierte Beta mit echten Personen und nachvollziehbarer Fehlerliste.

System-, DNS- oder kostenpflichtige Änderungen werden erst im dafür ausdrücklich freigegebenen Schritt vorgenommen.

## 4. Einheitliches Kartendesign und native Betatests

Im Web kann Leaflet bestehen bleiben. Ein ruhiger heller Hintergrund, reduzierte Beschriftung und petrolfarbene Marker/Cluster passen zum bestehenden Design. CARTO Positron und MapTiler Light/Pastel sind Kandidaten. Vor der Integration API-Key, Nutzungstarif und Attribution festlegen. Native Karten verwenden bislang Apple/Google Maps; identische Hintergrundkarten über alle Plattformen brauchen eine gesonderte Provider-/Renderingentscheidung.

Aktuelle Anbieterquellen: <https://www.carto.com/basemaps/>, <https://www.carto.com/legal/basemap-terms/>, <https://docs.maptiler.com/leaflet/examples/map-style/>.

Native Abnahme umfasst reale Android-/iOS-Geräte, Anmeldung, Mail-Deep-Links, Uploads, Karten-/Pin-Gesten, langsame Netze und nachvollziehbare Offline-/Fehlermeldungen. Danach signierte Testbuilds, TestFlight und Android-Testverteilung. Hermes-Exporte allein sind keine Geräte-/Storefreigabe.

## 5. Echte Marktwertanalyse

- Zunächst einen Recherchemarkt/Land und zugelassene Datenquellen festlegen.
- Nutzungsrechte, Datenumfang, Aktualisierung, Vergleichbarkeit und Anfragekosten prüfen.
- Asynchronen Worker mit Wiederholungen, Fehlerstatus und Fortschritt implementieren.
- Ergebnisse mit echten Vergleichsobjekten, Quellen, Recherchezeitpunkt, Unsicherheiten und Preisspanne verknüpfen.
- Angebotspreise und tatsächliche Transaktionswerte unterscheiden; fehlende Daten sichtbar machen.
- Ein Analyseergebnis als datierten Vorschlag speichern. Übernahme in den eigenen Marktwert bleibt eine ausdrückliche Benutzeraktion.
- Unfertige Analysefunktionen in veröffentlichten Versionen über einen Feature-Schalter ausblenden.

## 6. Store-Veröffentlichung

Betreiberidentität, Apple-/Google-Entwicklerkonten, Signierung, Storetexte, Screenshots, Support-/Datenschutzlinks und Review-Zugang vorbereiten. Kontolöschung gehört zum Konten-Release: Apple beschreibt den In-App-Pfad, Google zusätzlich den Web-Pfad. Aktuelle Quellen: <https://developer.apple.com/support/offering-account-deletion-in-your-app/>, <https://support.google.com/googleplay/android-developer/answer/13327111>.

Nach Geräteabnahme und Beta-Feedback Store-Einreichung vorbereiten und ausdrücklich freigeben lassen. Die Entscheidung der Stores bleibt ein externer Schritt.

## Empfohlener nächster Meilenstein

Kontoverwaltung plus Admin-MVP abschließen. Kartenanbieter/visuelle Richtung und Recherchemarkt parallel als Produktentscheidungen festlegen; weitere Ideen zunächst im Backlog halten.

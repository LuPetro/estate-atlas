# KI-Marktpreisrecherche

Die Recherche ist implementiert und bei neuen Installationen standardmäßig ausgeschaltet (`ANALYSIS_ENABLED=false`). Der Eigentümer hat am 11.10.2026 die Tageslimits aufgehoben: Auf diesem VPS ist GPT-6 Luna freigegeben, beide Tageslimits stehen auf `0` (keine Tagesquote). Manuell gestartete App-Recherchen und sparsame, gezielte Entwicklertests sind erlaubt; automatische Wiederholungen oder Serienaufträge sind nicht freigegeben. Der Key ist inzwischen hinterlegt. Der erste vom Eigentümer gestartete Live-Auftrag erreichte die Berechnung, scheiterte aber an der Mindestzahl akzeptierter Vergleichsangebote. Die bisherigen Daten enthalten keine Ausschlussdiagnose dieses Auftrags; die genaue Ursache ist rückwirkend nicht bestimmbar. Beim Aufheben der Tageslimits wurde kein zusätzlicher kostenpflichtiger Test gestartet. Tests mit synthetischen Providerantworten beweisen den Ablauf, nicht die Qualität aktueller Immobilienangebote.

## OpenAI-Key auf diesem Server hinterlegen

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/set-openai-key
```

Den Key beim unsichtbaren Prompt eingeben und Enter drücken. Er liegt anschließend in `.local/docker/openai-api-key`; der Ordner ist privat (0700) und vollständig von Git und Docker-Build-Kontext ausgeschlossen. Compose mountet die Datei als `/run/secrets/openai_api_key` ausschließlich in API und Worker. Die Datei muss für den nicht privilegierten Containerbenutzer lesbar sein (0644 innerhalb des privaten Host-Ordners). Niemals ins Frontend, in `NEXT_PUBLIC_*`, Chat, Screenshots oder Commits schreiben. Das Skript bewahrt bei leerer/ungültiger Eingabe den bisherigen Key.

Der Key wird beim Containerstart gelesen. Nach einem Austausch müssen API und Worker neu erstellt werden, damit der neue Dateiinode und die neue Konfiguration verwendet werden.

## Aktivieren – erst nach ausdrücklicher Kostenfreigabe

Die Projektregel in `AGENTS.md` verlangt ausdrücklich eine Freigabe kostenpflichtiger Dienste. Der Key allein aktiviert nichts. Nach Freigabe diese **nicht geheimen** Einstellungen in `.local/docker/compose.env` ergänzen/ändern:

```dotenv
ANALYSIS_ENABLED=true
ANALYSIS_MODELS=gpt-6-luna
ANALYSIS_USER_DAILY_LIMIT=0
ANALYSIS_GLOBAL_DAILY_LIMIT=0
```

```bash
./scripts/docker up -d --force-recreate --wait api worker
```

Die Standardwerte für neue Installationen sind 5 pro Nutzer und 20 global. `0` deaktiviert die jeweilige Tagesquote ausdrücklich. Der Eigentümer hat für diesen privaten Testbetrieb beide Quoten aufgehoben; daher sind auf diesem VPS beide Werte `0`. Für einen bewusst begrenzten Einzeltest können beide Werte auf `1` gesetzt werden. Sind bereits Aufträge innerhalb der letzten 24 Stunden reserviert, werden diese mitgezählt. Ein Abbruch oder Fehler gibt die Reservierung nicht zurück. Das Löschen einer Immobilie umgeht das Kostenlimit nicht. `ANALYSIS_ENABLED=false` und derselbe Neustart schalten neue Recherchen aus; bereits laufende Aufrufe können trotzdem Kosten verursacht haben. In einer Sitzung mit alter Gruppenmitgliedschaft die Docker-Befehle mit `sg docker -c '…'` ausführen.

Modellwechsel ohne Codeänderung: `ANALYSIS_MODELS` enthält eine kommaseparierte Liste freigegebener Responses-Modelle, die Websuche, Structured Outputs und `reasoning.effort=low` unterstützen. Das erste ist Standard; beide Apps zeigen dieselbe Liste. Verfügbarkeit/Kompatibilität des konkreten API-Kontos vor einer Freigabe prüfen. Kein stilles Upgrade auf teurere Modelle. Weitere Anbieter implementieren `ResearchProvider`; Queue, Berechnung und Clients bleiben davon unabhängig.

## Ablauf und Kostenbegrenzung

1. Eine aktive, reale Immobilie öffnen; Modell wählen; Übermittlung der Objektmerkmale und API-Kosten bestätigen; „Marktpreis recherchieren“ drücken. Keine automatische Recherche beim Anlegen/Öffnen.
2. Die API speichert einen Auftrag und den minimalen Objekt-Snapshot. Adresse, GPS, Land, Art, Fläche, Währung, Zustand, Baujahr und Ausstattung werden übertragen. Konto, eigene Werte, Kaufpreis, Notizen, Bilder und Dokumente werden ausgeschlossen.
3. Ein eigener Docker-Worker recherchiert über OpenAI Responses mit echter `web_search`. Maximal vier Suchtool-Aufrufe und 6.000 Ausgabetokens inklusive Reasoning pro Request. Ein zweiter Request extrahiert strukturiert, ohne Webtools, ebenfalls höchstens 6.000 Ausgabetokens. Gesamtes Zeitlimit drei Minuten. Keine automatischen Wiederholungen kostenpflichtiger Aufrufe.
4. Die App pollt den gespeicherten Status. Schließen der Ansicht unterbricht den Auftrag nicht. „Abbrechen“ verhindert die Veröffentlichung eines nachträglichen Ergebnisses; laufende Drittanbieteraufrufe können schon berechnet sein.
5. Nur Kandidaten aus tatsächlich zurückgegebenen Suchquellen/Zitaten, mit passendem Land, Währung, Objektart, Lageangabe, Fläche, ausdrücklich belegter Flächeneinheit und passendem Zustand, sofern bekannt werden genutzt. Preis und Fläche erhalten getrennte, unveränderte Textbelege, die beide im Recherchetext vorkommen müssen. Das erlaubt nicht nebeneinander stehende Angaben und lokale Zahlenformate, ohne fehlende Zahlen oder Einheiten zu ergänzen. Mindestens drei Vergleichsobjekte aus zwei Websites; gleiche URL nur einmal. Angebotspreise und Transaktionen werden nicht gemischt. Bekannte Daten dürfen höchstens 180 Tage alt sein; undatierte aktive Angebote werden als unsicher markiert. Quadratfuß werden mit 1 sqft = 0,09290304 m² im gemeinsamen Berechnungscode umgerechnet; ursprüngliche Fläche/Einheit bleiben im Beleg erhalten. Unbekannte Einheiten werden nicht geraten. Extremwerte außerhalb 0,5–2 × Median werden ausgeschlossen.
6. Die App berechnet Median(Preis/m²) × Objektfläche. Die Spanne verwendet Quartile und mindestens ±15 % für Angebote oder ±10 % für Transaktionen, mit sinnvoller Rundung. Sie ist eine Preisindikation, kein Gutachten und kein statistisches Konfidenzintervall. Ohne ausreichende Daten wird kein Wert erzeugt.
7. Quellen, Evidenz, Vergleichsobjekte und Unsicherheiten prüfen. Erst „Geprüften Wert übernehmen“ ändert den eigenen Wert und erstellt einen datierten Verlaufseintrag. Mehrfaches Übernehmen desselben Auftrags ist idempotent; geänderte Objektmerkmale erfordern neue Recherche.

Tageslimits begrenzen Aufträge, nicht verbindlich einen Dollarbetrag. Nach aktueller [OpenAI-Preisliste](https://developers.openai.com/api/docs/pricing) kostet Websuche $10/1.000 Aufrufe plus Tokens; vier Suchaufrufe entsprechen $0,04 Toolgebühren plus Modell-/Suchinhaltstokens. [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) unterstützt Websuche und Structured Outputs. Der Konto-/Modellzugang funktionierte beim ersten Live-Auftrag; Quellenqualität und konkrete Gesamtkosten sind weiterhin nicht fachlich geprüft. Stand: 11.10.2026.

## Grenzen und Betrieb

KI-Extraktion kann Preise, Fläche, Lage und Aktualität falsch verstehen. Eine konsultierte URL beweist nicht die Richtigkeit einer einzelnen Zahl; zwei Websites können dasselbe Objekt oder denselben Anbieter enthalten. Keine direkten Portal-Feeds, unabhängige Angebotsverifikation, bewertete Vergleichsqualität, Zustandskorrekturen oder verifizierte Verkaufspreise garantiert. Nicht zugängliche/paywallgeschützte Angebote werden nicht umgangen. Öffentliche Ergebnislinks werden nur im Browser geöffnet, nicht vom Backend abgerufen.

Queue und Ergebnisse liegen in PostgreSQL. `SKIP LOCKED` verhindert doppelte Worker-Zuweisung; Heartbeat und Timeout erkennen unterbrochene Aufträge. Abgestürzte laufende Aufträge werden fehlgeschlagen statt automatisch erneut berechnet. Die anonyme Kostenreservierung enthält nur Auftrag-ID, Benutzer-ID und Zeitpunkt; sie bleibt bei Objektlöschung bestehen. Worker-Healthcheck prüft die Prozess-Lebendigkeit, nicht OpenAI-Guthaben oder Modellqualität.

Lokale Tests verwenden gekennzeichnete synthetische Antworten und isolierte PostgreSQL-Datenbanken, nie die normale Benutzerdatenbank oder kostenpflichtige OpenAI-Requests. Native JS-Exporte ersetzen keine echten Android-/iOS-Gerätetests. Vor einer Produktveröffentlichung braucht es zusätzlich fachliche Qualitätsprüfung an realen Beispielen und geeignete Datenschutzinformationen.

## Diagnose nach einem erfolglosen Auftrag

Seit Migration 003 werden Quellen, Anzahl extrahierter und belegter Angebote sowie akzeptierte Vergleiche und Websites auch bei einer fehlgeschlagenen Berechnung gespeichert. Ausschlüsse zeigen jeweils den ersten zutreffenden Grund pro Angebot (Quelle/Evidenz, Duplikat, Währung, Land, Art, Zustand, Lage, Fläche, Aktualität, Preisbasis oder Ausreißer). Web und native App zeigen diese Aufschlüsselung unter „Was hat die Recherche gefunden?“. Recherchierte Quellen können Übersichtsseiten oder unpassende Angebote sein; sie sind nicht automatisch verwendbare Vergleichsobjekte.

Der begrenzte Recherchetext (maximal 60.000 Zeichen) und die strukturierte Extraktion werden privat am Auftrag gespeichert. Die öffentlichen HTTP-Antworten enthalten ausschließlich die eigentümergeschützte Diagnose, nie diesen Rohtext, Nutzungsabrechnung oder Zugangsdaten. Das Löschen des Objekts entfernt auch diese Auftragsdaten. Frühere fehlgeschlagene Aufträge haben keine nachträglich rekonstruierbare Diagnose. Quellen-/Preisangaben werden weiterhin von KI gelesen, nicht unabhängig gegen das Portal verifiziert.

Die Suche bekommt die tatsächlichen Vergleichsregeln ausdrücklich mitgeteilt, verwendet lokale Suchbegriffe und priorisiert innerhalb des unveränderten Budgets eine zweite Website. Getrennte Belege lösen ein unnötiges Formatproblem, garantieren aber keine ausreichenden zugänglichen Angebote. Die dokumentierte Eigentümerfreigabe erlaubt inzwischen manuelle App-Aufträge ohne Tagesquote sowie sparsame gezielte Entwicklertests innerhalb des unveränderten Auftragsbudgets. Fehler oder Diagnose löschen die bisherige Nutzungsreservierung nicht.

## Kontrollierte Nutzung ohne Tagesquote

Mit beiden Tageslimits `0` bleibt jede Recherche ein ausdrücklich gestarteter, angemeldeter und eigentümergeprüfter Auftrag mit Zustimmung zur Datenübermittlung/Kosten. Pro Auftrag bleiben höchstens vier Webtool-Aufrufe, zwei Modellantworten, jeweils höchstens 6.000 Ausgabetokens und drei Minuten Zeitlimit. Keine automatischen kostenpflichtigen Wiederholungen. Ein bereits aktiver Auftrag für dasselbe Objekt wird zurückgegeben statt doppelt gestartet. Die kurze Begrenzung auf sechs Start-Anfragen pro Minute bleibt als Klick-/Spam-Schutz bestehen; sie ist keine Tagesquote. Der einzelne Docker-Worker verarbeitet die Aufträge nacheinander. Nutzungsreservierungen und verfügbare Provider-Nutzungszahlen werden weiterhin gespeichert.

## Länderbeleg und Reparatur des Österreich-Auftrags

Beim zweiten Live-Auftrag beschrieb der Recherchebericht vier Wohnungen in Österreich, die bisherige Extraktion lieferte aber den erfundenen Code `OZ`. Die damalige Regex akzeptierte beliebige zwei Großbuchstaben. Das Zielobjekt war korrekt mit `AT` gespeichert; alle vier Angebote wurden dadurch als anderes Land aussortiert.

Die KI erzeugt jetzt keinen Ländercode mehr: Sie liefert einen unveränderten `countryEvidence`-Textbeleg aus dem Inseratblock. Der gemeinsame Code normalisiert explizite englische/deutsche Ländernamen oder bezeichnete ISO-Codes anhand registrierter Länder. Standort, Preis und Fläche müssen in demselben Block mit dem Angebotslink vorkommen. Die Website-Endung und das Land des Zielobjekts bestimmen das Angebotsland nicht. Unbekannte/mehrdeutige Länderbelege erhalten einen eigenen Ausschlussgrund. Immobilien- und Geocoder-Eingaben akzeptieren ebenfalls registrierte Codes statt frei erfundener Kürzel. Die Länderliste ist ein fester Snapshot aus Unicode CLDR (249 aktuelle Alpha-2-Codes, ohne deprecated/user-assigned Codes); kein Runtime-Download und keine neue Abhängigkeit.

Der Bericht hatte zudem zwei bekannte Neubau-/Erstbezugsangebote, die nicht zum Zielzustand passen. Die bloße Länderreparatur ergibt daher zwei passende Angebote, weiterhin unterhalb der Mindestzahl drei. Neue Suchaufträge starten mit dem Postbezirk/Viertel und berücksichtigen mehrere Straßen und andere Portale/Makler, statt an der exakten Zielstraße festzuhalten. Budget und Bewertungskriterien bleiben unverändert.

Für eine administrative, kostenlose Neuprüfung aktueller fehlgeschlagener Aufträge enthält das API-Image `dist/reprocess-analysis.mjs`. Der Docker-Aufruf erhält genau `{ "jobId": "UUID", "ownerId": "UUID" }` über stdin. Die Eigentümerprüfung, unveränderte Objektmerkmale und höchstens 24 Stunden alte gespeicherte Belege sind zwingend. Nur eindeutige Länderangaben aus dem eigenen Inseratblock korrigieren alte Codes. Rohantworten und ursprüngliche Diagnose bleiben privat zum Vergleich erhalten. Kein OpenAI-Aufruf, keine neue Nutzungsreservierung und keine Änderung des eigenen Marktwerts; selbst ein ausreichend belegtes neu berechnetes Ergebnis muss ausdrücklich übernommen werden.

Nach privater Sicherung wurde genau dieser gespeicherte Auftrag neu geprüft: zwei akzeptierte Vergleiche aus zwei Websites, zwei Ausschlüsse wegen Zustand. Das ist eine Neuprüfung des damaligen Berichts, keine unabhängige Aktualitätsbestätigung: Der damalige deutsche Scout-Link war bei einer zusätzlichen Abfrage nicht mehr abrufbar (HTTP 410).

Die neue Docker-Version wurde am 11.10.2026 mit genau einem gezielten, autorisierten Live-Auftrag geprüft. Sechs Angebote wurden extrahiert, fünf bestanden die Textbelegprüfung, drei aus zwei Websites die Vergleichsregeln. Ein fehlender oder inkonsistenter Flächenbeleg und zwei unpassende Zustände wurden ausgeschlossen. Drei Webtool-Aktionen, zwei Modellantworten, keine Wiederholung; gemeldete Nutzung: 35.178 Eingabe- und 3.152 Ausgabetokens. Die App errechnete 229.000 EUR mit 195.000–264.000 EUR Spanne und niedriger Sicherheit. Der eigene Wert wurde nicht übernommen/geändert.

Die drei Ergebnislinks wurden zusätzlich manuell über die Webwerkzeuge geöffnet: [Park-Angebot](https://www.willhaben.at/iad/immobilien/d/eigentumswohnung/wien/wien-1200-brigittenau/eigentum-statt-miete-direkt-beim-park-finanzierungsbeispiel-eur-903-mtl-1912682485/), [Augarten-/Gaußplatz-Angebot](https://www.willhaben.at/iad/immobilien/d/eigentumswohnung/wien/wien-1200-brigittenau/wohnung-unmittelbar-bei-augarten-und-gaussplatz-provisionsfrei-ohne-makler-1671670403/) und [Immowelt-Angebot](https://www.immowelt.at/expose/3be343ca-3a28-49a9-884c-042a83f5a816). Die verwendeten Datenfelder waren lesbar. Beim ersten Inserat widerspricht die Beschreibung der Kopfzeile (52 statt 50 m²), beim zweiten der Kaufpreisangabe (265.000 statt 260.000 EUR); beim dritten fehlt die genaue Adresse. Diese konkreten Hinweise wurden beim noch nicht übernommenen Ergebnis und seiner Diagnose ergänzt; ursprüngliche KI-Belege bleiben erhalten. Der Test beweist einen funktionierenden Ablauf mit realen Angeboten, keine fachlich geprüfte Immobilienbewertung oder automatisierte unabhängige Portalprüfung.

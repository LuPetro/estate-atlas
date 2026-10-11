# KI-Marktpreisrecherche

Die Recherche ist implementiert und bei neuen Installationen standardmäßig ausgeschaltet (`ANALYSIS_ENABLED=false`). Der Eigentümer hat den ersten App-Auftrag ausdrücklich freigegeben; auf diesem VPS sind GPT-6 Luna und beide Tageslimits `1` vorbereitet. Aktuell fehlt noch der Key; ohne Key bleibt die Recherche deaktiviert. Es gab bislang keinen kostenpflichtigen OpenAI-Test. Ein erfolgreicher Test mit synthetischen Providerantworten beweist den Ablauf, nicht die Qualität aktueller Immobilienangebote oder den Modellzugang des API-Kontos.

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
ANALYSIS_USER_DAILY_LIMIT=5
ANALYSIS_GLOBAL_DAILY_LIMIT=20
```

```bash
./scripts/docker up -d --force-recreate --wait api worker
```

Für den ersten Einzeltest beide Tageslimits auf `1` setzen. Sind bereits Aufträge innerhalb der letzten 24 Stunden reserviert, werden diese mitgezählt. Ein Abbruch oder Fehler gibt die Reservierung nicht zurück. Das Löschen einer Immobilie umgeht das Kostenlimit nicht. `ANALYSIS_ENABLED=false` und derselbe Neustart schalten neue Recherchen aus; bereits laufende Aufrufe können trotzdem Kosten verursacht haben. In einer Sitzung mit alter Gruppenmitgliedschaft die Docker-Befehle mit `sg docker -c '…'` ausführen.

Modellwechsel ohne Codeänderung: `ANALYSIS_MODELS` enthält eine kommaseparierte Liste freigegebener Responses-Modelle, die Websuche, Structured Outputs und `reasoning.effort=low` unterstützen. Das erste ist Standard; beide Apps zeigen dieselbe Liste. Verfügbarkeit/Kompatibilität des konkreten API-Kontos vor einer Freigabe prüfen. Kein stilles Upgrade auf teurere Modelle. Weitere Anbieter implementieren `ResearchProvider`; Queue, Berechnung und Clients bleiben davon unabhängig.

## Ablauf und Kostenbegrenzung

1. Eine aktive, reale Immobilie öffnen; Modell wählen; Übermittlung der Objektmerkmale und API-Kosten bestätigen; „Marktpreis recherchieren“ drücken. Keine automatische Recherche beim Anlegen/Öffnen.
2. Die API speichert einen Auftrag und den minimalen Objekt-Snapshot. Adresse, GPS, Land, Art, Fläche, Währung, Zustand, Baujahr und Ausstattung werden übertragen. Konto, eigene Werte, Kaufpreis, Notizen, Bilder und Dokumente werden ausgeschlossen.
3. Ein eigener Docker-Worker recherchiert über OpenAI Responses mit echter `web_search`. Maximal vier Suchtool-Aufrufe und 6.000 Ausgabetokens inklusive Reasoning pro Request. Ein zweiter Request extrahiert strukturiert, ohne Webtools, ebenfalls höchstens 6.000 Ausgabetokens. Gesamtes Zeitlimit drei Minuten. Keine automatischen Wiederholungen kostenpflichtiger Aufrufe.
4. Die App pollt den gespeicherten Status. Schließen der Ansicht unterbricht den Auftrag nicht. „Abbrechen“ verhindert die Veröffentlichung eines nachträglichen Ergebnisses; laufende Drittanbieteraufrufe können schon berechnet sein.
5. Nur Kandidaten aus tatsächlich zurückgegebenen Suchquellen/Zitaten, mit passendem Land, Währung, Objektart, Lageangabe, Fläche und ausdrücklich belegter Flächeneinheit und bekanntem passendem Zustand werden genutzt. Evidenz muss im Recherchetext vorkommen und Preis/Fläche enthalten. Mindestens drei Vergleichsobjekte aus zwei Websites; gleiche URL nur einmal. Angebotspreise und Transaktionen werden nicht gemischt. Bekannte Daten dürfen höchstens 180 Tage alt sein; undatierte aktive Angebote werden als unsicher markiert. Quadratfuß werden mit 1 sqft = 0,09290304 m² im gemeinsamen Berechnungscode umgerechnet; ursprüngliche Fläche/Einheit bleiben im Beleg erhalten. Unbekannte Einheiten werden nicht geraten. Extremwerte außerhalb 0,5–2 × Median werden ausgeschlossen.
6. Die App berechnet Median(Preis/m²) × Objektfläche. Die Spanne verwendet Quartile und mindestens ±15 % für Angebote oder ±10 % für Transaktionen, mit sinnvoller Rundung. Sie ist eine Preisindikation, kein Gutachten und kein statistisches Konfidenzintervall. Ohne ausreichende Daten wird kein Wert erzeugt.
7. Quellen, Evidenz, Vergleichsobjekte und Unsicherheiten prüfen. Erst „Geprüften Wert übernehmen“ ändert den eigenen Wert und erstellt einen datierten Verlaufseintrag. Mehrfaches Übernehmen desselben Auftrags ist idempotent; geänderte Objektmerkmale erfordern neue Recherche.

Tageslimits begrenzen Aufträge, nicht verbindlich einen Dollarbetrag. Nach aktueller [OpenAI-Preisliste](https://developers.openai.com/api/docs/pricing) kostet Websuche $10/1.000 Aufrufe plus Tokens; vier Suchaufrufe entsprechen $0,04 Toolgebühren plus Modell-/Suchinhaltstokens. [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) unterstützt Websuche und Structured Outputs. Konkrete Gesamtkosten/Qualität/Accountzugang sind noch nicht live geprüft. Stand: 11.10.2026.

## Grenzen und Betrieb

KI-Extraktion kann Preise, Fläche, Lage und Aktualität falsch verstehen. Eine konsultierte URL beweist nicht die Richtigkeit einer einzelnen Zahl; zwei Websites können dasselbe Objekt oder denselben Anbieter enthalten. Keine direkten Portal-Feeds, unabhängige Angebotsverifikation, bewertete Vergleichsqualität, Zustandskorrekturen oder verifizierte Verkaufspreise garantiert. Nicht zugängliche/paywallgeschützte Angebote werden nicht umgangen. Öffentliche Ergebnislinks werden nur im Browser geöffnet, nicht vom Backend abgerufen.

Queue und Ergebnisse liegen in PostgreSQL. `SKIP LOCKED` verhindert doppelte Worker-Zuweisung; Heartbeat und Timeout erkennen unterbrochene Aufträge. Abgestürzte laufende Aufträge werden fehlgeschlagen statt automatisch erneut berechnet. Die anonyme Kostenreservierung enthält nur Auftrag-ID, Benutzer-ID und Zeitpunkt; sie bleibt bei Objektlöschung bestehen. Worker-Healthcheck prüft die Prozess-Lebendigkeit, nicht OpenAI-Guthaben oder Modellqualität.

Lokale Tests verwenden gekennzeichnete synthetische Antworten und isolierte PostgreSQL-Datenbanken, nie die normale Benutzerdatenbank oder kostenpflichtige OpenAI-Requests. Native JS-Exporte ersetzen keine echten Android-/iOS-Gerätetests. Vor einer Produktveröffentlichung braucht es zusätzlich fachliche Qualitätsprüfung an realen Beispielen und geeignete Datenschutzinformationen.

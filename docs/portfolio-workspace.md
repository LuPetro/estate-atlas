# Portfolio-Arbeitsbereiche

Web und native App besitzen einen eigenen Werte-Tab. Er zeigt aktuelle Bestandssummen je Währung und gespeicherte Verläufe je Immobilie. Suche, Land, Immobilienart, aktuelle Objektwährung und hinterlegter Vermietungsstatus lassen sich kombinieren. Zusätzlich sind einzelne Immobilien, Gesamtverlauf/12 Monate/30 Tage, Sortierung nach Name/Veränderung in Prozent/letzter Wertangabe und Archivobjekte auswählbar.

Der Vermietungsfilter „Mietvertrag hinterlegt“ umfasst geplante, laufende und beendete Verträge. Der jeweilige Zustand wird an der Immobilie angezeigt. „Nicht angegeben“ ist ein eigener Zustand für Bestandsdaten.

Historien kommen über `GET /portfolio/valuations` aus einem SQL-Join mit den eigenen und ausdrücklich freigegebenen Immobilien des angemeldeten Nutzers. Der Endpunkt liefert ausschließlich Wertangaben; keine Anhänge oder Recherche-Rohberichte. Archivierte Beobachtungen bleiben abrufbar, archivierte Immobilien zählen aber niemals zur aktuellen Summe. Löschen entfernt sie weiterhin über die bestehenden Datenbankregeln.

Aktuelle Summen verwenden die aktuellen Objektwerte; der Zeitfilter gilt für die historischen Verläufe. Es gibt keine rückwirkend erfundene Portfolio-Gesamtkurve. Die Einzelverläufe haben eigene Skalen und sind kein Vergleich auf einer gemeinsamen Achse. Prozentänderungen beziehen sich auf den ersten und letzten tatsächlich gespeicherten Wert derselben Währung im Zeitraum; bei weniger als zwei Werten oder Null-Basis gibt es keine Prozent-Rendite. Auswahl nach Objektwährung bedeutet die aktuell hinterlegte Währung; vergangene Währungen bleiben im jeweiligen Verlauf separat auswählbar. Für eine saubere Gesamtentwicklung müssten Zu-/Abgänge und Währungswechsel ausdrücklich modelliert werden.

Dashboard-Filter gelten gleichzeitig für Kennzahlen, Karte, Verteilung und Immobilienliste. Kennzahlen, Karte, Werte/Verteilung und Liste sind einzeln ausblendbar. Diese Bereichsauswahl wird pro Nutzer im Browser-LocalStorage bzw. im nativen SecureStore gespeichert, validiert und bei Abmeldung vom nächsten Konto getrennt. Sie wird nicht zwischen Geräten synchronisiert. Filter sind Sitzungszustand; die Web-Navigation setzt sie zurück. Dies ist eine anpassbare Übersicht mit festen Bereichen, kein Drag-and-drop-Berichtsbaukasten.

Die kompakte KI-Recherche befindet sich im Überblick des Objektbereichs neben den wesentlichen Objektdaten. „Recherche vorbereiten“ öffnet Einstellungen und Zustimmung. Laufender Status, Fehlerdiagnose und Ergebnisse bleiben sichtbar. Der Vorbereitungsbutton löst keine Analyse aus. Modellwahl, ausdrückliche Kosten-/Datenzustimmung, Nutzereigentum und vorhandene Anfragegrenzen bleiben wirksam. Die Entwicklung und Tests dieser Änderung verwenden keine bezahlten OpenAI-Aufrufe.

## Verteilung und Dokumente

Der Bereich „Verteilung“ gruppiert aktive eigene Immobilien nach Land, Immobilienart oder Vermietung. Marktwert, Anzahl und Fläche sind auswählbar. Die Währungsgruppe grenzt bei allen drei Kennzahlen dieselben Immobilien ein; Geldbeträge verschiedener Währungen werden nie zusammengerechnet. Die Vermietungsverteilung unterscheidet nicht angegeben, frei, geplant, aktuell vermietet und beendet anhand der hinterlegten Vertragsdaten. Nullsummen erzeugen keine erfundenen Prozentanteile. Archivierte Immobilien zählen nicht zum aktuellen Bestand.

Dokumente bleiben optional. Der zentrale Dokumentenbereich und der Dokumentenreiter einer Immobilie greifen auf dieselben privaten Anhänge zu. Unterstützt werden PDF, JPEG, PNG und WebP mit tatsächlicher Dateitypprüfung, höchstens 10 MB pro Datei und 30 Anhänge pro Immobilie. Dateien werden in PostgreSQL gespeichert und ausschließlich über authentifizierte API-Aufrufe geladen; es gibt keine öffentlichen Dateilinks. Eine Freigabe umfasst auch die Dokumente der jeweiligen Immobilie. Kein Upload startet automatisch eine KI-Verarbeitung.

## Einstieg, Import, Wiedervorlagen und PDF-Bericht

Ein leeres Portfolio zeigt in Web und nativer App drei klare nächste Schritte: eine Immobilie anlegen, eine CSV- oder Excel-Liste übernehmen oder synthetische Testdaten ansehen. Testdaten bleiben ausdrücklich gekennzeichnet.

Der Tabellenimport unterstützt CSV-Dateien mit Komma oder Semikolon sowie Excel-Dateien (`.xlsx`, `.xls`, erstes Tabellenblatt), jeweils bis 50 Immobilien. Vor dem Speichern zeigt er gültige und fehlerhafte Zeilen. Deutsche und englische Überschriften werden erkannt. Erforderlich sind Bezeichnung, Adresse, ISO-2-Ländercode, Breitengrad, Längengrad, Objektart, Kaufpreis, Marktwert, Währung und Fläche. Preise verwenden die deutsche Dezimalschreibweise; Ausstattungsmerkmale lassen sich mit `|` trennen. CSV-Dateien sind auf 1 MB, Excel-Dateien auf 5 MB begrenzt. Fehlerhafte Zeilen werden ausgelassen. Gültige Zeilen werden samt Anfangswert in einer gemeinsamen Transaktion gespeichert, daher wird bei überschrittener Kontogrenze kein Teilimport angelegt. Dateien werden auf dem Gerät gelesen; Adressen werden nicht automatisch an Photon oder einen anderen Geocoder gesendet.

Wiedervorlagen gehören zu einer Immobilie und sind für berechtigte Portfolio-Mitglieder sichtbar. Eigentümer und Bearbeiter können sie erstellen, erledigen, erneut öffnen oder löschen; Betrachter können sie lesen. Es gibt bis zu 50 offene Wiedervorlagen je Immobilie. Überfällige Termine werden in der Webansicht hervorgehoben.

Jedes berechtigte Mitglied kann sich persönlich per E-Mail erinnern lassen, auch mit Leserechten. Die Einstellung gilt ausschließlich für das eigene bestätigte Konto. Beim Erstellen ist sie freiwillig und standardmäßig aus; bestehende Wiedervorlagen aktivieren keine E-Mails automatisch. Wählbar sind der Fälligkeitstag sowie ein, drei oder sieben Tage vorher. Der Versand wird ab 09:00 Uhr in der gespeicherten Gerätezeitzone eingeplant; ein heute bereits verstrichener Zeitpunkt wird zeitnah nachgeholt. Eine neue E-Mail für vergangene Fälligkeitstage ist nicht möglich. Die Nachricht enthält Titel, Immobilienbezeichnung, Fälligkeit und einen Link zu den Wiedervorlagen, keine Notizen oder Finanzbuchungen. Ohne SMTP oder bestätigte Adresse erläutert die Oberfläche die Voraussetzung.

Der Maintenance-Dienst bearbeitet die dauerhafte Versandwarteschlange alle 30 Sekunden in begrenzten Chargen. Vor dem Senden prüft er erneut Kontostatus, bestätigte Adresse, aktuelle Freigabe, Archivierung und Erledigung. Deaktivieren, Löschen und Freigabewiderruf stoppen den eigenen ausstehenden Versand; Erledigen und Archivieren stoppen die ausstehenden E-Mails der Wiedervorlage beziehungsweise Immobilie. Wiederöffnen aktiviert sie nicht automatisch erneut. Abgelaufene Termine werden nach Tagesende in der gewählten Zeitzone nicht nachträglich verschickt.

Ein Versandauftrag wird vor SMTP dauerhaft als übernommen markiert. Eindeutige vorübergehende SMTP-Ablehnungen (4xx) werden mit 15 Minuten Abstand höchstens dreimal versucht. Bei unklarem Ausgang, etwa nach einem Verbindungsabbruch, gibt es keinen automatischen erneuten Versand. Die Oberfläche unterscheidet vorgemerkt, gesendet, fehlgeschlagen, unklar, abgelaufen und abgebrochen; bei fehlgeschlagenem oder unklarem Versand kann der Nutzer bewusst erneut vormerken. Ein SMTP-Erfolg bedeutet Annahme durch den Mailserver, keine bestätigte Postfachzustellung. Push-Nachrichten werden nicht geplant.

Der PDF-Bericht lässt sich aus dem Browser herunterladen oder über die native Teilen-Funktion weitergeben. Im Browser wählst du eigene Immobilien aus; die native App exportiert den aktiven eigenen Bestand. Der Bericht enthält selbst gepflegte Werte und den Vermietungsstatus. Adressen sind standardmäßig ausgeschlossen und müssen aktiv eingeblendet werden. Beträge tragen eindeutige Währungscodes; Summen werden je Währung getrennt gebildet. Objekteinträge bleiben beim Seitenumbruch zusammen. Die PDF-Datei wird auf dem Gerät erstellt. Der vollständige Kontoexport enthält zusätzlich die gespeicherten Wiedervorlagen.

## Monatliche Einnahmen und Ausgaben

Der eigene Bereich in der Web-Navigation beziehungsweise unter „Mehr“ in der nativen App erfasst einzelne Buchungen mit Bezeichnung, Datum, Kategorie, positivem Betrag, Währung und optionaler Notiz. Kategorien sind Mieteinnahmen, sonstige Einnahmen, laufende Kosten, Reparatur/Instandhaltung, Kreditrate und sonstige Ausgaben. Beträge erlauben höchstens zwei Nachkommastellen; JPY wird in ganzen Yen geführt. Beim Eingeben werden Dezimalkomma und Dezimalpunkt unterstützt, keine automatisch interpretierten Tausendertrennzeichen.

Monat, einzelne Immobilie und die ausdrückliche Einbeziehung freigegebener Immobilien sind auswählbar. Standardmäßig werden nur eigene Immobilien ausgewertet. Monatsbeträge und die Aufstellung je Immobilie umfassen den vollständigen gewählten Zeitraum, unabhängig von den 50 Einträgen pro Buchungsseite. Einnahmen, Ausgaben und Saldo bleiben nach Währung getrennt. Jede Buchung bewahrt ihre gewählte Währung auch nach einer späteren Änderung der Objektwährung. Die Übersicht beruht ausschließlich auf eingetragenen Buchungen; es gibt keine automatische Bankanbindung, Zahlungserkennung, wiederkehrende Buchung oder Steuerberechnung.

Eigentümer und Bearbeiter können Buchungen hinzufügen, ändern und nach Bestätigung löschen; Betrachter können lesen. Eine Versionsprüfung verhindert stilles Überschreiben paralleler Änderungen. Wiederholte identische Speicheranfragen desselben Entwurfs legen keine zweite Buchung an. Pro Immobilie sind bis zu 10.000 Buchungen vorgesehen. Historische Buchungen archivierter Immobilien bleiben in der Monatsübersicht sichtbar, Änderungen erfordern das Wiederherstellen der Immobilie. Die Buchungen eigener Immobilien und die persönlichen E-Mail-Einstellungen sind im vollständigen Kontoexport enthalten. Löschen einer Immobilie entfernt ihre Buchungen und Versandaufträge über die Datenbankbeziehungen.

Migration `008_reminder_email_cashflow.sql` ergänzt separate Buchungs- und Versandtabellen. Bestehende Immobilien, Werte und Wiedervorlagen werden dabei nicht umgeschrieben.

## Übergabe und Kaufcheck

Ein Objektarbeitsbereich speichert bis zu zwölf Checklisten mit jeweils höchstens 80 Punkten, Datum, allgemeinen Notizen sowie einer Notiz und einem Erledigt-Status je Punkt. Vorlagen für Objektübergabe und Besichtigung erleichtern den Anfang. Die gemeinsame Validierung begrenzt die Größe der Inhalte. Checklisten sind Arbeitshilfen; das Speichern stellt keine rechtsgültige Unterschrift dar.

Der Kaufcheck rechnet mit selbst eingegebenem Kaufpreis, Prozentsätzen für Erwerbsteuer, Notar und Vermittlung, sonstigen Kosten, Renovierungsbudget und Eigenmitteln. Er zeigt Nebenkosten, Gesamtinvestition und verbleibenden Finanzierungsbedarf beziehungsweise überschüssige Eigenmittel. Gesetzliche Steuersätze oder Kreditkonditionen werden nicht vorgegeben. Geldkomponenten werden auf Währungseinheiten gerundet, bei JPY auf ganze Yen. Die Währung wird mit dem Kaufcheck gespeichert: Eine spätere Änderung der Objektwährung führt nicht zu einer stillen Umrechnung bestehender Annahmen.

Checklisten und Kaufcheck werden gemeinsam mit einer Versionsnummer gespeichert. Gleichzeitige Änderungen überschreiben sich nicht unbemerkt: Bei einer veralteten Version antwortet die API mit HTTP 409; der aktuelle Stand muss geladen und die Änderung erneut übernommen werden. Beim Wechsel zwischen den Reitern bleiben ungespeicherte Eingaben erhalten.

## Teilen und Zusammenarbeit

Eigentümer können pro Immobilie einen einmal verwendbaren Einladungscode mit Lese- oder Bearbeitungsrechten erzeugen und ihn selbst weitergeben. Der Empfänger meldet sich mit einem eigenen Konto an und nimmt den Code unter „Geteilt mit mir“ an. Es werden keine E-Mails verschickt. Codes laufen nach sieben Tagen ab; gespeichert wird nur ihr kryptografischer Hash. Höchstens zehn offene Einladungen und 30 Mitwirkende pro Immobilie sind erlaubt. Nachträglich angenommene Einladungen können die Rolle eines bestehenden Mitglieds ändern.

| Aktion                                                           | Eigentümer | Bearbeitung | Lesen |
| ---------------------------------------------------------------- | ---------- | ----------- | ----- |
| Objekt, Wertverlauf, Dokumente, Checklisten, Kaufcheck lesen     | Ja         | Ja          | Ja    |
| Objekt bearbeiten, Dokumente verwalten, Arbeitsbereich speichern | Ja         | Ja          | Nein  |
| Archivieren, Wiederherstellen, Objekt löschen                    | Ja         | Nein        | Nein  |
| Einladen, offene Einladung oder Mitgliedschaft widerrufen        | Ja         | Nein        | Nein  |
| Kostenpflichtige Recherche starten, abbrechen, Wert übernehmen   | Ja         | Nein        | Nein  |

Freigegebene Objekte erscheinen ausdrücklich unter „Geteilt mit mir“. Die eigenen Dashboard-, Karten-, Verteilungs- und Wertkennzahlen enthalten standardmäßig nur Eigentum. Ein Eigentümer sieht Namen und E-Mail-Adressen der beteiligten Konten in der Mitgliederverwaltung; Empfänger erhalten keine Mitgliederliste. Die Rollen werden serverseitig für alle privaten Ressourcen geprüft, einschließlich direkter Datei- und Rechercheaufrufe. Nach Widerruf werden neue API-Zugriffe abgewiesen; bereits heruntergeladene Dateien lassen sich technisch nicht zurückholen.

Migration `004_property_workspace.sql` ergänzt Arbeitsbereiche, Mitglieder und Einladungen ohne vorhandene Objektdaten umzuschreiben. Automatisierte Prüfungen verwenden ausschließlich separate Testdatenbanken und synthetische Recherchequellen.

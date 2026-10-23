# EstateAtlas · Nutzergewinnung

> **Vorbereitete Beiträge:** Die Texte in diesem Dokument sind noch nicht auf LinkedIn oder in externen Communities veröffentlicht. Den Open-Source-Aufruf erst nach der öffentlichen GitHub-Veröffentlichung verwenden. Aussagen zur öffentlichen Registrierung erst verwenden, wenn der echte Produktionsablauf einschließlich E-Mail-Zustellung geprüft ist; siehe [Web-Start](web-launch.md). Die private Dev-Vorschau ist kein öffentlicher Demo-Zugang.

## Erster Aufruf zum Open-Source-Start

Dieser Aufruf führt zum Quellcode und zur ersten Feedbackrunde. Er setzt keinen öffentlichen Demo- oder Registrierungszugang voraus.

**LinkedIn, persönlicher Beitrag:**

> Ich veröffentliche EstateAtlas unter der MIT-Lizenz: einen selbst hostbaren Workspace für Immobilien, Unterlagen, Mietzeiträume und eigene Wertnotizen.
>
> Ich suche fünf private Eigentümer oder Vermieter, die heute mit Tabellen und Ordnern arbeiten und mir zeigen möchten, wo dabei Zeit verloren geht. Besonders interessiert mich: Klappt es, eine erste Immobilie anzulegen oder eine vorhandene Liste zu importieren? Und welche Aufgabe würde euch nächste Woche zurückbringen?
>
> Quellcode, Screenshots und Docker-Einstieg: https://github.com/LuPetro/estate-atlas
>
> Fragen und Feedback: https://github.com/LuPetro/estate-atlas/discussions
>
> Wer nicht selbst hostet, kann mir hier mit einem Kommentar sein Interesse an einem Gespräch sagen. Bitte keine privaten Objektangaben oder Dokumente veröffentlichen.

**Community, sofern Projektvorstellungen dort erlaubt sind:**

> **EstateAtlas: MIT-lizenzierter Immobilien-Workspace, erste Nutzerfeedbackrunde**
>
> Ich baue EstateAtlas für Eigentümer, die Immobilieninformationen bisher auf Tabellen, Ordner und Notizen verteilen. CSV/Excel-Import, Dokumente pro Objekt, Mietzeiträume, eigene Wertverläufe und ein PDF-Bericht sind bereits enthalten. Die Web-App und native React-Native-Clients nutzen dieselbe API; native Store-Builds und Geräteabnahme sind noch offen.
>
> Der Quellcode steht unter MIT, der Einstieg läuft über Docker: https://github.com/LuPetro/estate-atlas
>
> Ich suche besonders Feedback von privaten Eigentümern: Welche Information sucht ihr regelmäßig? Wo scheitert ein Import? Was fehlt nach dem ersten angelegten Objekt? Der erste Test konzentriert sich auf diese Aufgaben. KI-Recherche ist optional und braucht eine eigene Providerkonfiguration; gespeicherte Werte sind keine professionellen Gutachten.
>
> Fragen oder Erfahrungen gern in https://github.com/LuPetro/estate-atlas/discussions. Bitte keine echten Adressen, Zugangsdaten oder Unterlagen posten.

Der [Leitfaden für fünf Eigentümergespräche](feedback-pilot.md) beschreibt Beobachtung, freiwilligen Follow-up und Messung. Es sind noch keine Gespräche oder neuen Nutzer bestätigt. Die folgenden älteren Texte beziehen sich auf einen späteren, tatsächlich geprüften Hosted-Start.

## Positionierung

EstateAtlas hilft privaten Immobilieneigentümern, ihre Objekte, selbst gepflegten Wertnotizen, Mietzeiträume und Unterlagen in einem privaten Portfolio zu ordnen. Wer bisher eine Tabelle pflegt, kann bis zu 50 Objekte aus einer CSV- oder Excel-Liste übernehmen; einen ausgewählten Bestand kann man als PDF teilen. Es ist kein Immobilienportal und verspricht keine automatische oder professionelle Bewertung.

**Kernbotschaft:** Deine Immobilien. Ein klarer Überblick.

**Erster Nutzerkreis:** Eigentümer mit mehreren Wohnungen oder Häusern, die Informationen heute über Tabellen, Ordner und Notizen verteilen.

**Einziger nächster Schritt:** Ein Konto mit E-Mail-Adresse erstellen. Die Registrierung ist offen; zum Schutz der Konten muss die E-Mail-Adresse bestätigt werden.

Die Startseite öffnet direkt die Anmeldung mit der Hausillustration und dem gemeinsamen Kompass-Logo. Der Reiter „Registrieren“ bzw. `/?register=1` führt zur Kontoerstellung. `/portfolio` bleibt als kompatibler Einstieg erhalten.

## Vor der Veröffentlichung

1. Änderungen lokal prüfen und über den bereits vorgesehenen CI-/Production-Ablauf veröffentlichen. Ein Git-Push allein veröffentlicht nicht.
2. Im Browser `https://estateatlas.app/` öffnen und vom Hauptbutton bis zur bestätigten Registrierung durchgehen.
3. Eine Registrierung abschließen, die E-Mail verifizieren und den ersten Portfolio-Eintrag mit einem eigenen Testkonto prüfen.
4. Für jede Veröffentlichung den Link mit einer Quelle markieren, z. B. `https://estateatlas.app/?utm_source=linkedin&utm_medium=organic&utm_campaign=open_signup`. Es ist aktuell kein Analytics-Dienst konfiguriert; Antworten und freiwillig gemeldete erfolgreiche Registrierungen daher wöchentlich manuell zählen; bestehende Einladungen sind kein Registrierungsmaßstab.

## LinkedIn-Beitrag

> Ich baue EstateAtlas, weil mir der Überblick über Immobilieninformationen zu verstreut war: Objekte hier, eigene Wertnotizen dort, Mietzeiträume und Dokumente wieder woanders.
>
> EstateAtlas bündelt das in einem privaten Immobilienportfolio. Du kannst Objekte per CSV oder Excel übernehmen, auf einer Karte sehen, eigene Werte und Wiedervorlagen festhalten und Dokumente beim Objekt ablegen. Einen ausgewählten Bestand kannst du als PDF-Bericht teilen. Werte trägst du selbst ein; EstateAtlas behauptet keine automatische Bewertung.
>
> Ich suche gerade private Eigentümer, die das Produkt im Alltag ausprobieren und mir offen sagen, was fehlt. Die Anmeldung braucht eine bestätigte E-Mail-Adresse: https://estateatlas.app/
>
> Wenn du mehrere Immobilien verwaltest und es testen möchtest, schreib mir kurz, wie du heute den Überblick behältst.

## Community-Beitrag

> **Frage an private Vermieter und Eigentümer:** Wie behaltet ihr den Überblick über mehrere Immobilien, Mietzeiträume, selbst gepflegte Werte und die zugehörigen Unterlagen? Nutzt ihr dafür eine Tabelle?
>
> Ich entwickle EstateAtlas als privaten Workspace dafür. Eine vorhandene Liste lässt sich per CSV oder Excel übernehmen; Termine und Unterlagen bleiben am Objekt. Den Bestand kann man als PDF-Bericht weitergeben. Keine automatischen Wertversprechen und kein Inserate-Marktplatz.
>
> Ich suche eine kleine Gruppe, die es praktisch ausprobiert und Feedback gibt. Die Registrierung ist offen unter https://estateatlas.app/.

Diesen Text nur in Communities posten, in denen Produktfeedback oder Eigenwerbung ausdrücklich erlaubt ist. Auf Antworten eingehen, keine Direktnachrichten ohne Einverständnis senden.

## Kurze E-Mail-Antwort auf Produktfeedback

**Betreff:** Danke für dein EstateAtlas-Feedback

Hallo,

danke für dein Interesse an EstateAtlas. Du kannst dir unter https://estateatlas.app/ direkt ein Konto erstellen. Mich würde außerdem interessieren, wie viele Objekte du verwaltest und welche Information du darin am häufigsten suchst. Das hilft mir, die nächsten Verbesserungen zu priorisieren.

Viele Grüße
Luka

## Zwei-Wochen-Test

- **Woche 1:** Ein persönlicher LinkedIn-Beitrag und ein einzelner passender Community-Beitrag. Gespräche führen, keine identischen Posts in mehreren Gruppen verteilen.
- **Woche 2:** Einen häufig genannten Anwendungsfall als kurzen Produktbeitrag zeigen, z. B. Mietzeiträume oder Unterlagen pro Objekt. Nur ein Thema pro Beitrag.
- **Jeden Freitag:** qualifizierte Besuche, gestartete Registrierungen, bestätigte Konten und wiederkehrendes Feedback zählen. Wenn Besucher nicht registrieren, zuerst Botschaft und Registrierungsablauf prüfen.

**Erfolgssignal für den ersten Test:** fünf Eigentümergespräche und mindestens drei neue Nutzer, die ihre E-Mail bestätigen und ein eigenes Objekt eintragen. Diese Zielwerte sind ein Experiment, keine Prognose.

# Auf dem iPhone testen

## Aktueller privater Web-Zugang

EstateAtlas läuft in Docker. Web und API sind absichtlich nur an die VPS-Loopback-Adresse gebunden: `127.0.0.1:3000` und `127.0.0.1:4000`. Auf dem PC funktioniert das über die bestehenden SSH-Portweiterleitungen. Das iPhone kann die PC-Adresse `localhost` nicht übernehmen: `localhost` bezeichnet immer das Gerät, auf dem der Browser läuft.

Für denselben privaten Test auf dem iPhone eine SSH-App verwenden, die **lokale Portweiterleitungen** unterstützt, und mit dem vorhandenen VPS-SSH-Zugang verbinden. In der SSH-App zwei Weiterleitungen anlegen:

| Lokaler Port auf dem iPhone | Ziel vom VPS aus |
| --------------------------- | ---------------- |
| 3000                        | 127.0.0.1:3000   |
| 4000                        | 127.0.0.1:4000   |

Dann die SSH-Verbindung aktiv halten und in Safari **`http://localhost:3000`** öffnen. Beide Weiterleitungen sind nötig: Der aktuelle Web-Build ruft die API unter `http://localhost:4000` auf. Genau `localhost` verwenden, damit die konfigurierte Browser-Origin stimmt. Falls Safari zwar die Oberfläche lädt, aber die Anmeldung scheitert, zuerst die zweite Weiterleitung und das Fortbestehen der SSH-Verbindung prüfen. iOS kann Hintergrundverbindungen beenden; die SSH-App muss Hintergrund-Weiterleitung unterstützen. Keine Zugangsdaten im Chat oder in Git hinterlegen.

Ohne eine geeignete SSH-App ist der nächste praktische Schritt ein per HTTPS erreichbarer Testzugang. Der ist derzeit **nicht eingerichtet**. Eine Domain, eine erreichbare API-Adresse, TLS und die Browser-Origin müssen dabei zusammen konfiguriert werden. Nur einen VPS-Port zu öffnen oder die PC-LAN-Adresse zu verwenden reicht mit dem aktuellen Build nicht. SSH-/Firewall-Regeln bleiben bei dieser Änderung unverändert.

## Native iPhone-App

`./scripts/pnpm mobile:export` prüft und erzeugt Android-/iOS-JavaScript-Bundles. Das Ergebnis ist **keine installierbare IPA/APK**. Ein erfolgreicher Export ist kein Gerätetest.

Für eine zuverlässig installierbare iPhone-Testversion ist eine signierte iOS-App nötig. Der vorgesehene Weg für diesen Linux-VPS ist ein EAS-Build und Verteilung über TestFlight oder intern registrierte Testgeräte. Voraussetzung: ein Expo-Projekt/Account, ein Apple-Developer-Konto mit passenden Signierrechten und eine vom iPhone erreichbare HTTPS-API. `EXPO_PUBLIC_API_URL` muss diese API-Adresse beim Build enthalten; sie ist öffentlich, kein API-Schlüssel. OpenAI-Schlüssel bleiben ausschließlich im API-/Worker-Docker-Secret.

Noch nicht eingerichtet: EAS-Projekt, Signierzertifikate, Provisioning, TestFlight und öffentliche HTTPS-API. Es wurden keine Cloud-Builds gestartet, keine Apple-Konten geändert und keine kostenpflichtigen Dienste bestellt.

Expo Go ist nur eine optionale Vorschau, wenn dessen installierte Version zum SDK und den nativen Modulen des Projekts passt. EstateAtlas verwendet Expo SDK 57. Die offizielle Download-Seite muss diese Kompatibilität bestätigen; ein beliebiges Expo Go aus dem App Store plus QR-Code ist dafür keine belastbare Zusage. Ein Expo-Tunnel transportiert den Entwicklungsserver und ersetzt keinen separat erreichbaren API-Zugang. Die optionale Metro-Vorschau läuft in Docker:

```bash
./scripts/pnpm dev:mobile
./scripts/docker --profile mobile logs --tail=50 mobile
```

Bei noch veralteter Docker-Gruppenzugehörigkeit diese Befehle mit `sg docker -c 'BEFEHL'` ausführen. Zusätzlich zur API-Weiterleitung den lokalen iPhone-Port 8081 auf `127.0.0.1:8081` des VPS weiterleiten. **Nur mit bestätigt passender Expo-Go-Version** `exp://localhost:8081` in Expo Go öffnen. API bleibt `http://localhost:4000`, sofern keine erreichbare HTTPS-API beim Image-Build konfiguriert wurde. Die Server-Vorschau alleine bestätigt keine Expo-Go-Kompatibilität und keinen Gerätetest. Nach Änderungen das Vorschaubild über `dev:mobile` neu bauen. Mit `./scripts/docker --profile mobile stop mobile` den optionalen Container wieder stoppen.

Offizielle Informationen:

- [Expo: Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo: Interne Verteilung und iOS-Geräteregistrierung](https://docs.expo.dev/build/internal-distribution/)
- [Expo: Expo Go und App Store](https://expo.dev/changelog/expo-go-and-app-store-may-2026)
- [Expo: Erster signierter Build](https://docs.expo.dev/build/setup/)

## Gerätetest nach Einrichtung

Auf einem echten iPhone prüfen: Anmeldung/Abmeldung, Werte-Tab mit Länder-/Währungs-/Vermietungsfiltern, Dashboard-Bereiche ausblenden und nach Neustart wiederfinden, Karte mit Gesten, Formular bei geöffneter Tastatur, Mietzeitraum, Foto/PDF-Auswahl und Dateifreigabe. KI-Einstellungen öffnen darf keinen Rechercheauftrag starten; erst Zustimmung und Start dürfen ihn auslösen. Rückkehr aus dem Hintergrund muss einen laufenden Auftrag wieder anzeigen.

Für die neuen Arbeitsbereiche zusätzlich prüfen: Unter „Mehr“ Verteilung nach Land/Art/Vermietung und Wert/Anzahl/Fläche, Dokumentensuche und Wechsel zwischen eigenen/geteilten Objekten. Im Objekt Übergabevorlage anlegen, Notizen ändern, zwischen Bereichen wechseln und speichern; beim Zurückwischen dürfen ungespeicherte Eingaben erst nach Bestätigung verworfen werden. Kaufcheck-Währung, Kosten und Finanzierungsbedarf nach App-Neustart kontrollieren. Mit zwei Konten einen Einladungscode über die native Freigabeoberfläche teilen, Leserechte/Bearbeitungsrechte und Widerruf prüfen. Authentifiziertes PDF-Öffnen und das System-Freigabefenster benötigen ebenfalls einen echten Gerätetest.

# GitHub-Integration

## Aktueller Stand

- Git-Repository auf Branch `main` lokal vorhanden.
- GitHub CLI projektlokal installiert; `./scripts/gh --version` zeigt die Version.
- `./scripts/gh auth status`: Anmeldung als `LuPetro` bestätigt.
- Privates Repository nach ausdrücklicher Freigabe erstellt: [LuPetro/estate-atlas](https://github.com/LuPetro/estate-atlas).
- `origin`: `https://github.com/LuPetro/estate-atlas.git`.
- Repository-Erstellung und erster Push wurden ausdrücklich freigegeben. Für das Update mit Portfolio, Dokumenten, Checklisten, Kaufcheck, Zusammenarbeit und neuer Oberfläche hat der Eigentümer erneut ausdrücklich „GitHub pushen“ beauftragt. GitHub Actions prüft jeden Push; das Ergebnis muss zum aktuellen Commit gehören.
- `.local/`, `.env`, Datenbank, Tokens, Cache und Build-Ausgaben sind ignoriert.

## Anmeldung auf einem neuen Rechner

Auf diesem VPS ist die folgende Anmeldung bereits abgeschlossen.

In einer eigenen interaktiven VPS-Sitzung ausführen:

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/gh auth login --hostname github.com --git-protocol https --web
```

Falls gefragt, die automatische Git-Credential-Konfiguration ablehnen, damit keine globale Git-Konfiguration geändert wird. Einen ausschließlich lokalen Credential-Helper enthält bereits dieses Repository.

Die CLI zeigt eine GitHub-URL und einen kurzlebigen Gerätecode. Diese URL im eigenen Browser öffnen, den angezeigten Code eingeben, bei GitHub anmelden und die GitHub-CLI-Autorisierung bestätigen. Kein Token und keinen privaten Schlüssel in den Chat kopieren. Der Gerätecode gehört nur in den GitHub-Anmeldedialog. Sicherheits- oder Organisationsabfragen normal abschließen.

Der Wrapper setzt `GH_CONFIG_DIR` auf die ignorierte `.local/github`-Konfiguration. GitHub CLI verwendet nach Möglichkeit den Betriebssystem-Credential-Store und kann auf einem VPS ohne Keyring auf eine lokale Datei zurückfallen. Dieses Verzeichnis privat halten und nicht mit dem Quellcode übertragen. Es wird kein SSH-Key benötigt, weil die vorbereitete Verbindung HTTPS verwendet.

Danach:

```bash
./scripts/gh auth status
```

Die Freigaben für die Erstellung des privaten Repositorys und den ersten Push wurden erteilt. Bei späteren neuen Repositorys oder weiteren nicht freigegebenen Pushes weiterhin die Projektregeln beachten.

## Verwendete Befehle

Repository-Erstellung und Verknüpfung (ohne Push):

```bash
./scripts/gh repo create estate-atlas --private --source=. --remote=origin
```

Ausdrücklich freigegebener erster Push:

```bash
git push -u origin main
```

Falls ein Repository dieses Namens schon existiert, zunächst Eigentümer, Sichtbarkeit und Inhalt prüfen, statt es zu ersetzen oder neu anzulegen. Nach dem ersten Push läuft die vorbereitete CI aus `.github/workflows/ci.yml`.

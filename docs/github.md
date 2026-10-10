# GitHub-Integration

## Aktueller Stand

- Git-Repository auf Branch `main` lokal vorhanden.
- GitHub CLI projektlokal installiert; `./scripts/gh --version` zeigt die Version.
- `./scripts/gh auth status`: keine Anmeldung.
- `git remote -v`: noch kein Remote.
- Es wurde kein GitHub-Repository angelegt und nichts gepusht.
- `.local/`, `.env`, Datenbank, Tokens, Cache und Build-Ausgaben sind ignoriert.

## Einmalige Aktion durch den Product Owner

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

Sobald du die Anmeldung abgeschlossen hast, ausdrücklich mitteilen, ob ich das private Repository `estate-atlas` erstellen und verbinden darf und ob ein erster Push freigegeben ist. Diese Freigaben sind noch ausständig.

## Erst nach ausdrücklicher Freigabe

Repository-Erstellung und Verknüpfung (ohne Push):

```bash
./scripts/gh repo create estate-atlas --private --source=. --remote=origin
```

Erster Push, separat freizugeben:

```bash
git push -u origin main
```

Falls ein Repository dieses Namens schon existiert, zunächst Eigentümer, Sichtbarkeit und Inhalt prüfen, statt es zu ersetzen oder neu anzulegen. Nach dem ersten Push läuft die vorbereitete CI aus `.github/workflows/ci.yml`.

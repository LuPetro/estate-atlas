'use client';

import { useEffect, useState } from 'react';

type Language = 'de' | 'en';

const translations: Record<string, string> = {
  'EstateAtlas · Dein Immobilienportfolio': 'EstateAtlas · Your property portfolio',
  'App installieren': 'Install app', 'Hilfe': 'Help', 'Datenschutz': 'Privacy', 'Impressum': 'Legal notice',
  'Nutzung': 'Terms', 'Konto löschen': 'Delete account', 'Service und Rechtliches': 'Support and legal',
  'EstateAtlas': 'EstateAtlas', 'Deine Immobilien. Eine klare Perspektive. Private Portfolios auf Web, Android und iOS.': 'Your properties. A clearer perspective. Private portfolios on web, Android and iOS.',
  'EstateAtlas wird geladen …': 'Loading EstateAtlas …', 'Willkommen bei EstateAtlas': 'Welcome to EstateAtlas',
  'DEIN PORTFOLIO': 'YOUR PORTFOLIO', 'Mein Workspace': 'My workspace', 'Weltkarte': 'World map',
  'Geteilt mit mir': 'Shared with me', 'Verteilung': 'Allocation', 'Persönlicher Workspace': 'Personal workspace',
  'Werte, Unterlagen und Zusammenarbeit an einem Ort.': 'Values, documents and collaboration in one place.',
  'Eine neue Recherche kann der Eigentümer starten.': 'Only the owner can start new research.',
  'Die Freigabe umfasst Objektangaben, Wertverlauf, Dokumente, Checklisten und Kaufcheck. Bearbeitende können diese Angaben und Dateien ändern. Löschen, Archivieren, Freigaben und kostenpflichtige Recherche bleiben beim Eigentümer.': 'Access includes property details, value history, documents, checklists and purchase checks. Editors can change these details and files. Deletion, archiving, access management and paid research remain with the owner.',
  'Der Code gilt 7 Tage und kann einmal von einem angemeldeten Konto angenommen werden. Teile ihn persönlich mit der gewünschten Person. Einladungen werden nicht automatisch per E-Mail verschickt.': 'The code is valid for 7 days and can be redeemed once by a signed-in account. Share it directly with the intended person. Invitations are not sent automatically by email.',
  'Dein Immobilien-Workspace': 'Your property workspace', 'DEIN IMMOBILIEN-WORKSPACE': 'YOUR PROPERTY WORKSPACE',
  'DEIN IMMOBILIENPORTFOLIO': 'YOUR PROPERTY PORTFOLIO', 'DEINE WELT. DEIN ATLAS.': 'YOUR WORLD. YOUR ATLAS.',
  'Deine Immobilien gehören dir.': 'Your properties belong to you.', 'Deine Immobilien.': 'Your properties.',
  'Deine Immobilien. Geordnet.': 'Your properties. Organised.', 'Persönlich. Sicher.': 'Personal. Secure.',
  'Privat & geschützt': 'Private & protected', 'Dein Portfolio bleibt geschützt': 'Your portfolio stays protected',
  'Zum Portfolio': 'Go to portfolio', 'Zur Anmeldung': 'Sign in', 'Zurück zur Anmeldung': 'Back to sign in',
  'Zur Startseite': 'Home', 'Zurück zu EstateAtlas': 'Back to EstateAtlas', 'Weiter': 'Continue', 'Zurück': 'Back',
  'Abbrechen': 'Cancel', 'Schließen': 'Close', 'Löschen': 'Delete', 'Bearbeiten': 'Edit', 'Speichern': 'Save',
  'Ansehen': 'View', 'Erneut laden': 'Reload', 'Aktualisieren': 'Refresh', 'Suchen': 'Search', 'Suche': 'Search',
  'Navigation öffnen': 'Open navigation', 'Meldung schließen': 'Dismiss message', 'Abmelden': 'Sign out',
  'Übersicht': 'Overview', 'Dashboard': 'Dashboard', 'Immobilien': 'Properties', 'Immobilie': 'Property',
  'Immobilie hinzufügen': 'Add property', 'Erste Immobilie hinzufügen': 'Add your first property',
  'Karte': 'Map', 'Karte öffnen': 'Open map', 'Karte wird geladen …': 'Loading map …', 'Archiv': 'Archive',
  'Portfolio-Wertentwicklung': 'Portfolio value history', 'Portfolio-Verteilung': 'Portfolio allocation',
  'Wertentwicklung': 'Value history', 'Werte & Perspektiven': 'Values & insights', 'Werte und Recherche': 'Values and research',
  'Dokumente': 'Documents', 'Dokumentenspeicher': 'Document storage', 'Zusammenarbeit': 'Collaboration',
  'Verwaltung': 'Administration', 'Mein Konto': 'My account', 'Profil': 'Profile', 'Konten': 'Accounts',
  'Beta-Einladungen': 'Beta invitations', 'Einladung erstellen': 'Create invitation', 'Einladungscode': 'Invitation code',
  'Einladungscode · nur jetzt sichtbar': 'Invitation code · shown only once', 'Einladung widerrufen': 'Revoke invitation',
  'Einladungsrolle': 'Invitation role', 'Gültigkeit in Tagen': 'Validity in days', 'Gültig bis': 'Expires',
  'Offene Einladungen': 'Open invitations', 'Letzte Einladungen': 'Recent invitations',
  'Jeder Code ist einmal verwendbar und wird nur jetzt angezeigt.': 'Each code can be used once and is shown only now.',
  'Teile Einladungen nur mit den vorgesehenen Personen und prüfe die gewählte Rolle. Eigentümer können Freigaben zurücknehmen. Bereits heruntergeladene Kopien bleiben bei den Empfängern.': 'Share invitations only with the intended people and check the selected role. Owners can revoke access. Copies already downloaded remain with recipients.',
  'Du bestimmst, wer diese Immobilie sehen und bearbeiten kann.': 'You decide who can view and edit this property.',
  'Du entscheidest, welche Immobilien du teilst.': 'You decide which properties to share.',
  'Dateien hinzufügen': 'Add files', 'Datei hinzufügen': 'Add file', 'Dateien': 'Files', 'Fotos & Dokumente': 'Photos & documents',
  'Dateien sind für dich und Personen mit Zugriff auf diese Immobilie sichtbar.': 'Files are visible to you and people with access to this property.',
  'Dokumente suchen': 'Search documents', 'Dokumente nach Immobilie': 'Documents by property', 'Alle Dateitypen': 'All file types',
  'Übergabe & Checklisten': 'Handover & checklists', 'Übergabe vorbereiten': 'Prepare handover',
  'Objekt-Checklisten': 'Property checklists', 'Eigene Checkliste': 'Custom checklist', 'Checklisten & Protokollnotizen': 'Checklists & handover notes',
  'Kaufcheck': 'Purchase checklist', 'Kaufcheck erstellen': 'Create purchase checklist', 'Kauf durchrechnen': 'Calculate purchase costs',
  'Marktpreis prüfen': 'Research market price', 'KI-Marktpreis recherchieren': 'Research market price with AI',
  'Vergleichsangebote und Quellen für eine aktuelle Preisindikation.': 'Comparable listings and sources for a current price indication.',
  'Vergleichsobjekte & Quellen ansehen': 'View comparable properties & sources', 'Was hat die Recherche gefunden?': 'What did the research find?',
  'Recherchemodell': 'Research model', 'Recherche abbrechen': 'Cancel research', 'Recherchierte Preisindikation': 'Researched price indication',
  'Marktwert': 'Market value', 'Marktwert¹': 'Market value¹', 'Eigener Marktwert': 'Your estimate', 'Gespeicherte eigene Angaben und übernommene Recherchewerte. Jede Währung bleibt getrennt; zwischen den Punkten wurden keine Werte erhoben.': 'Saved values you entered and research estimates you accepted. Each currency is kept separate; no values were collected between data points.',
  'Land': 'Country', 'Adresse': 'Address', 'Straße, Hausnummer, PLZ und Ort': 'Street, house number, postcode and city',
  'Immobilienart': 'Property type', 'Fläche (m²)': 'Area (m²)', 'Baujahr': 'Year built', 'Ausstattung': 'Features',
  'Zustand': 'Condition', 'Währung': 'Currency', 'Alle Länder': 'All countries', 'Alle Immobilienarten': 'All property types',
  'Filter zurücksetzen': 'Reset filters', 'Keine Immobilien passen zu dieser Auswahl.': 'No properties match these filters.',
  'Vermietung': 'Rental', 'Vermietet': 'Rented', 'Nicht vermietet': 'Not rented', 'Mietbeginn': 'Lease start', 'Mietende': 'Lease end',
  'Dashboard anpassen': 'Customise dashboard', 'Ansicht wählen': 'Choose view', 'Alle': 'All', 'Aktiv': 'Active', 'Gesperrt': 'Locked',
  'E-Mail-Adresse': 'Email address', 'E-Mail': 'Email', 'Passwort': 'Password', 'Neues Passwort': 'New password',
  'Aktuelles Passwort': 'Current password', 'Anmelden': 'Sign in', 'Registrieren': 'Create account', 'Konto erstellen': 'Create account',
  'Passwort vergessen / E-Mail bestätigen': 'Forgot password / verify email', 'Passwort zurücksetzen': 'Reset password',
  'E-Mail bestätigen': 'Verify email', 'Bestätigung erneut senden': 'Resend verification', 'Einladung annehmen: Code': 'Accept invitation: code',
  'Nur mit Einladung': 'Invitation only', 'Zu einer Immobilie eingeladen?': 'Invited to a property?', 'Code einfügen': 'Enter code',
  'Privates Portfolio': 'Private portfolio', 'Daten exportieren': 'Export data', 'Dein Konto löschen': 'Delete your account',
  'Konto endgültig löschen': 'Permanently delete account', 'Hilfe & Kontakt': 'Help & contact', 'Support kontaktieren': 'Contact support',
  'Die richtigen Menschen. Der passende Zugriff.': 'The right people. The right access.', 'Menschen. Zugang. Überblick.': 'People. Access. Overview.',
  'Konten sicher verwalten und Änderungen nachvollziehen.': 'Manage accounts securely and track changes.',
  'DEIN KONTO': 'YOUR ACCOUNT', 'DEIN ZUGANG': 'YOUR ACCESS', 'PLATTFORMVERWALTUNG': 'PLATFORM ADMINISTRATION',
  'Daten mitnehmen oder Konto löschen': 'Export your data or delete your account', 'Export und Löschung': 'Export and deletion',
  'So arbeitet EstateAtlas technisch': 'How EstateAtlas works', 'Verbindung zu anderen Diensten': 'Connections to other services',
  'Anmeldung und Speicherung auf deinem Gerät': 'Sign-in and storage on your device',
  'Export und Löschung findest du unter „Mein Konto“. Du bestätigst beide Aktionen mit deinem aktuellen Passwort und gegebenenfalls dem Zwei-Faktor-Code.': 'You can export or delete your data under “My account”. Confirm either action with your current password and, if enabled, your two-factor code.',
  'Diese Seite gibt es nicht.': 'This page could not be found.', 'Keine passenden Nutzer.': 'No matching users.',
  'Das hat gerade nicht funktioniert.': 'That did not work. Please try again.', 'Bitte versuche es erneut oder lade die Seite neu.': 'Please try again or reload the page.',
  'Ein neuer Anfang.': 'A fresh start.', 'Schön, dass du da bist.': 'Welcome back.',
  'Erstelle dein persönliches Konto und starte dein Portfolio.': 'Create your account and start your portfolio.',
  'Melde dich an, um dein Portfolio zu verwalten.': 'Sign in to manage your portfolio.', 'Dein Name': 'Your name',
  'Vor- und Nachname': 'First and last name', 'du@beispiel.at': 'you@example.com', 'Mindestens 12 Zeichen': 'At least 12 characters',
  'Zwei-Faktor-Code (falls eingerichtet)': 'Two-factor code (if enabled)',
  '6-stelliger Code oder Wiederherstellungscode': '6-digit code or recovery code',
  'Nur nötig, wenn du die Zwei-Faktor-Anmeldung aktiviert hast. Den Code findest du in deiner Authenticator-App; ein gespeicherter Wiederherstellungscode geht auch.': 'Only needed if you enabled two-factor authentication. Find the code in your authenticator app, or use a saved recovery code.',
  'Bitte warten …': 'Please wait …', 'Schon ein Konto?': 'Already have an account?', 'Neu bei EstateAtlas?': 'New to EstateAtlas?',
  'Die Web-App passt sich deinem Bildschirm an. Du kannst sie auch auf dem Startbildschirm installieren.': 'The web app adapts to your screen. You can also install it on your home screen.',
  'Kontodaten, Immobilien, Fotos, Dokumente und Rechercheaufträge liegen in der privaten PostgreSQL-Datenbank. Zugriffe erfordern Anmeldung und eine passende Objektberechtigung. Administratoren erhalten dadurch keinen automatischen Zugriff auf deine privaten Immobilieninhalte.': 'Account details, properties, photos, documents and research jobs are stored in a private PostgreSQL database. Access requires sign-in and permission for the relevant property. Administrators do not automatically get access to your private property data.',
  'Die vereinfachte Karte und Schriftarten werden lokal geladen. Eine aktiv eingegebene Adresssuche wird an den konfigurierten Photon-Dienst gesendet. Erst beim Einschalten der Detailkarte lädt der Browser Kartenkacheln von OpenStreetMap, gegebenenfalls CARTO; diese Dienste sehen IP-Adresse und Kartenausschnitt. Die KI-Recherche übermittelt Adresse, Position und Objektmerkmale an OpenAI und dessen Suchdienste erst nach deiner ausdrücklichen Zustimmung.': 'The simplified map and fonts are loaded locally. An address search is sent to the configured Photon service. Only when you enable the detailed map does the browser load map tiles from OpenStreetMap and, where configured, CARTO; these services can see your IP address and map area. AI research sends the address, location and property details to OpenAI and its search services only after your explicit consent.',
  'Die Web-Anmeldung verwendet ein technisch notwendiges HttpOnly-Sitzungscookie mit höchstens sieben Tagen Laufzeit. Dashboard-Einstellungen bleiben lokal auf deinem Gerät, getrennt nach Konto. Die PWA speichert nur einen allgemeinen Offline-Hinweis und dessen Darstellung. Es gibt keine eingebauten Werbetracker oder Analyse-Cookies.': 'Web sign-in uses a technically necessary HttpOnly session cookie with a maximum lifetime of seven days. Dashboard settings stay on your device, separated by account. The PWA stores only a general offline notice and its display state. There are no built-in advertising trackers or analytics cookies.',
  'Unter „Mein Konto“ kannst du eigene Daten inklusive Dateien exportieren oder dein Konto löschen. Geteilte eigene Immobilien müssen vorher übertragen oder Freigaben entfernt werden. Fremde Immobilien bleiben bestehen. Löschung in der Live-Datenbank entfernt eigene Inhalte unmittelbar; ältere Sicherungen enthalten sie bis zur Rotation. Die konkreten Aufbewahrungszeiten und Betreiberinformationen stehen in der oben veröffentlichten Datenschutzerklärung.': 'Under “My account”, you can export your data, including files, or delete your account. Transfer your shared properties or remove access before deletion. Other people’s properties remain. Deletion removes your content from the live database immediately; older backups retain it until rotation. Retention periods and operator details are in the published privacy notice above.',
  'Betreiber': 'Operator', 'Datenschutzkontakt:': 'Privacy contact:', 'Hosting:': 'Hosting:', 'Zum Löschablauf': 'View deletion process',
  'EstateAtlas auf deinem Gerät': 'EstateAtlas on your device', 'EstateAtlas installieren': 'Install EstateAtlas',
  'Auf deinem iPhone oder iPad': 'On your iPhone or iPad', 'Android und Computer': 'Android and computer',
  'EstateAtlas auf dem Handy': 'EstateAtlas on your phone', 'Service': 'Support', 'Nutzungshinweise': 'Terms of use',
  'Immobilien oder Orte suchen …': 'Search properties or places …', 'Immobilien suchen': 'Search properties',
  'Eigentümerschaft übertragen': 'Transfer ownership', 'Freigaben erneut laden': 'Reload access',
  'Zugriff entfernen': 'Remove access', 'Zugriff für die Einladung': 'Invitation access', 'Personen mit Zugriff': 'People with access',
  'Übertragung bestätigen': 'Confirm transfer', 'Neue Eigentümerin / neuer Eigentümer': 'New owner',
  'Übertrage eigene geteilte Immobilien an ein Mitglied oder entferne deren Freigaben.': 'Transfer your shared properties to a member or remove their access.',
  'Die ausgewählte Person übernimmt die Immobilie samt Dokumenten und Freigaben. Du behältst Bearbeitungsrechte. Offene Einladungen werden ungültig.': 'The selected person takes over the property, documents and access. You keep editing rights. Pending invitations become invalid.',
  'Du hast Leserechte für diese Immobilie.': 'You have read access to this property.', 'Weitergegeben': 'Shared',
  'Profil speichern': 'Save profile', 'Profil, Zugänge und Kontrolle über deine Daten.': 'Profile, access and control over your data.',
  'Aktive Sitzungen': 'Active sessions', 'Alle Sitzungen beenden': 'Sign out all sessions', 'Alle Sitzungen widerrufen': 'Revoke all sessions',
  'Sitzung beenden': 'Sign out session', 'Passwort ändern': 'Change password', 'Neue E-Mail-Adresse': 'New email address',
  'Neue Adresse bestätigen': 'Verify new address', 'Aktuellen Stand laden': 'Load current status',
  'Dein Speicher': 'Your storage', 'E-Mail bestätigt': 'Email verified',
  'Bestätigung ausstehend:': 'Verification pending:', 'Bestätigungscode aus einer E-Mail eingeben': 'Enter the code from your email',
  'E-Mail-Funktionen sind in dieser Testversion noch nicht verfügbar.': 'Email features are not available in this test version.',
  'Registrierung steuern': 'Manage registration', 'Öffentliche Registrierung': 'Public registration',
  'Registrierungsmodus ändern': 'Change registration mode', 'Registrierung:': 'Registration:',
  'E-Mail-Bindung (optional)': 'Bind to email (optional)', 'Codes herunterladen': 'Download codes',
  'Code gilt': 'Code valid for', 'Code ist einmal verwendbar.': 'Code can be used once.',
  'Die Schritte zeigen den tatsächlichen Serverstatus. Dein eigener Wert bleibt bis zur Übernahme erhalten.': 'These steps show the actual server status. Your own value remains until you accept the transfer.',
  'Status': 'Status', 'Aktion': 'Action', 'Akteur:': 'Actor:', 'Aktion bestätigen': 'Confirm action', 'Begründung': 'Reason',
  'Nutzer': 'Users', 'Nutzer suchen': 'Search users', 'Name oder E-Mail': 'Name or email', 'Letzte Anmeldung': 'Last sign-in',
  'Plattformrolle ändern': 'Change platform role', 'Neue Plattformrolle': 'New platform role', 'Konto sperren': 'Suspend account',
  'Konto entsperren': 'Restore account', 'Reset-Link an Nutzer senden': 'Send password reset link', 'Reset-Code eingeben': 'Enter reset code',
  'Kontometadaten und Verwaltungsaktionen. Keine Passwörter, Codes oder Immobilieninhalte.': 'Account metadata and administrative actions. No passwords, codes or property content.',
  'Private Immobilien und Dokumente sind hier nicht einsehbar. Konten mit eigenen Immobilien können nur durch den Besitzer vollständig gelöscht werden.': 'Private properties and documents are not visible here. Only an account owner can fully delete an account that owns properties.',
  'Verwaltungsbereiche': 'Administration areas', 'Bestand / Freigaben / Sitzungen': 'Portfolio / access / sessions',
  'Aktuelle gespeicherte Werte': 'Current saved values', 'aktive Immobilien · aktuelle gespeicherte Werte': 'active properties · current saved values',
  'Gesamtfläche': 'Total area', 'Geschätzter Portfoliowert': 'Estimated portfolio value', 'Gesamter Verlauf': 'Full history',
  'Alle zugänglichen Immobilien': 'All accessible properties', 'Alle ausgewählten Immobilien': 'All selected properties',
  'Über die gefilterten aktiven Immobilien': 'Across filtered active properties', 'Einzelne Immobilie': 'Single property',
  'Die Auswahl enthält ausschließlich aktive Immobilien in': 'Selection includes only active properties in',
  'Alle Beträge in': 'All amounts in', 'Andere Währungen werden separat betrachtet.': 'Other currencies are shown separately.',
  'Alle Währungen': 'All currencies', 'Währungsgruppe': 'Currency group', 'Währungsgruppe filtern': 'Filter currency group',
  'Dashboard-Währung': 'Dashboard currency', 'Währung der Wertentwicklung': 'Value history currency',
  'Zeitraum der Wertentwicklung': 'Value history period', 'Zeitraum für alle Immobilien': 'Period for all properties',
  'Entwicklung in %': 'Change in %', 'Differenz zu deinen Kaufpreisen': 'Difference from your purchase prices',
  'Immobilien in dieser Währungsgruppe': 'Properties in this currency group', 'In diesem Zeitraum wurden keine Werte in': 'No values were recorded in this period for',
  'Kaufpreis': 'Purchase price', 'Vermietungsstatus': 'Rental status',
  'Alle Vermietungsangaben': 'All rental statuses',
  'Zukünftige und abgelaufene Mietzeiträume werden entsprechend gekennzeichnet.': 'Future and past rental periods are labelled accordingly.',
  'Dateiname suchen …': 'Search file names …', 'Dokumenttyp': 'Document type',
  'JPEG, PNG, WebP oder PDF · maximal 10 MB je Datei · Zugriff gemäß Objektfreigabe': 'JPEG, PNG, WebP or PDF · up to 10 MB per file · access follows property permissions',
  'Exposés, Verträge, Protokolle und Fotos kannst du hier optional speichern.': 'Optionally store listings, contracts, handover notes and photos here.',
  'Lege hier bei Bedarf Exposés, Verträge, Übergabeprotokolle und Fotos ab.': 'Store listings, contracts, handover reports and photos here if needed.',
  'Schlüssel, Zählerstände und Zustand — Schritt für Schritt dokumentieren.': 'Document keys, meter readings and condition step by step.',
  'Die Checkliste hält deine Angaben fest. Fotos und unterschriebene Protokolle kannst du optional unter Dokumente speichern.': 'The checklist records your notes. You can optionally save photos and signed reports under Documents.',
  'Was ist zu prüfen?': 'What needs checking?', 'Notiz, Zählerstand oder Schlüsselanzahl …': 'Note, meter reading or number of keys …',
  'Titel der Checkliste': 'Checklist title', 'erledigt': 'completed', 'Offen': 'Open',
  'Marktwert (eigene Schätzung)': 'Market value (your estimate)', 'Quelle öffnen ↗': 'Open source ↗',
  'Vergleichsobjekte ·': 'Comparable properties ·', 'mit Preis- und Flächenbeleg ·': 'with price and area evidence ·',
  'passend aus': 'matching from', 'Websites': 'websites', 'Angebote ausgelesen ·': 'listings extracted ·',
  'Recherchierte Quellen; darunter können Übersichtsseiten und unpassende Angebote sein:': 'Sources reviewed; these may include overview pages and unrelated listings:',
  'Gespeicherte Marktwerte sind deine eigenen Angaben oder von dir übernommene Recherchevorschläge. Recherchen beziehen sich auf veröffentlichte Angebotspreise und bilden keine garantierten Verkaufspreise ab. Quellen können unvollständig, veraltet oder widersprüchlich sein. Prüfe das Ergebnis und seine Einschränkungen, bevor du es übernimmst.': 'Saved market values are your own estimates or research suggestions you accepted. Research uses published asking prices and does not represent guaranteed sale prices. Sources may be incomplete, outdated or inconsistent. Review the result and its limitations before accepting it.',
  'Anteil': 'Share', 'Anzahl': 'Count', 'Nach Name': 'By name', 'Gruppieren nach': 'Group by',
  'Vergleichen nach': 'Compare by', 'Sortieren nach': 'Sort by', 'Nach Land': 'By country', 'Nach Immobilienart': 'By property type',
  'Weltweiter Überblick': 'Global overview', 'Über Ländergrenzen hinweg. Immer bei dir.': 'Across borders. Always with you.',
  'Dein Portfolio, international': 'Your international portfolio', 'Wo deine Werte liegen': 'Where your value is',
  'Portfolio einpassen': 'Fit portfolio', 'Alle gefilterten Immobilien auf der Karte anzeigen': 'Show all filtered properties on map',
  'Filter gelten auch für die Kartenmarker. Klicke einen Marker für Details.': 'Filters also apply to map markers. Select a marker for details.',
  'GPS-Position': 'GPS location', 'Position auf der Karte': 'Location on map', 'Breitengrad': 'Latitude', 'Längengrad': 'Longitude',
  'Adressvorschläge': 'Address suggestions', 'Erneut suchen': 'Search again', 'Adressvorschlag auswählen oder auf die Karte klicken. Für eine genaue Position „Details anzeigen“ wählen und den Pin verschieben.': 'Choose an address suggestion or click on the map. For a precise location, select “Show details” and move the pin.',
  'Vorschläge ab 4 Zeichen. Suchtext wird an Photon gesendet. Daten:': 'Suggestions appear from 4 characters. Search text is sent to Photon. Data:',
  'GPS wird aus deiner Auswahl übernommen. Bei Bedarf kannst du die Koordinaten auch direkt bearbeiten.': 'GPS coordinates are taken from your selection. You can also edit them directly.',
  'Land (ISO-Code)': 'Country (ISO code)',
  'Immobilienart filtern': 'Filter property type',
  'Land filtern': 'Filter country', 'Währung filtern': 'Filter currency',
  'Bitte gültige, vollständige Beträge eingeben.': 'Enter valid, complete amounts.', 'Nicht angegeben': 'Not specified',
  'Füge eine Immobilie hinzu oder passe deine Filter an.': 'Add a property or adjust your filters.',
  'Recherche ist nur für aktive, reale Immobilien verfügbar.': 'Research is available only for active, real properties.',
  'Keine recherchierten Bewertungen.': 'No researched valuations.', 'Synthetische Immobilien und Beispielwerte sind gekennzeichnet. Keine recherchierten Bewertungen.': 'Synthetic properties and sample values are labelled. No researched valuations.',
  'Ein Zuhause für dein Immobilienportfolio.': 'A home for your property portfolio.', 'Neue Perspektiven beginnen mit Überblick.': 'A new perspective starts with an overview.',
  'RAUM FÜR DEINE WERTE': 'ROOM FOR YOUR VALUES', 'DEINE WERTE IM ZEITVERLAUF': 'YOUR VALUES OVER TIME',
  'ZUSAMMENSETZUNG': 'PORTFOLIO MIX', 'GEMEINSAM VERWALTEN': 'MANAGE TOGETHER', 'VORBEREITEN & FESTHALTEN': 'PREPARE & RECORD',
  'Dein Zuhause für alle wichtigen Immobilienwerte.': 'Your home for all your important property values.',
  'Keine Verteilung': 'No allocation yet', 'Noch zu finanzieren': 'Still to finance',
  'Gesamter Kapitalbedarf': 'Total capital required', 'Finanzierungsbedarf vor Zinsen und laufenden Kosten. Keine Finanzierungszusage.': 'Financing required before interest and ongoing costs. This is not a financing offer.',
  'Nebenkosten & Kapitalbedarf': 'Additional costs & capital required', 'Notar & Grundbuch': 'Notary & land registry',
  'Weitere Kosten': 'Other costs', 'Grunderwerbsteuer': 'Property transfer tax', 'Renovierung': 'Renovation',
  'Verbleibendes Eigenkapital:': 'Remaining equity:', 'Plane Kaufpreis, Nebenkosten, Renovierung und Eigenkapital gemeinsam.': 'Plan purchase price, additional costs, renovation and equity together.',
  'Dein Szenario wird separat gespeichert. Der Kaufpreis der Immobilie bleibt erhalten.': 'Your scenario is saved separately. The property purchase price remains unchanged.',
  'Diese Auswahl bleibt in diesem Browser für dein Konto gespeichert. Filter gelten für alle sichtbaren Bereiche.': 'This selection is saved in this browser for your account. Filters apply to all visible sections.',
  'Dein Entwurf bleibt erhalten. Prüfe ihn vor dem Neuladen; dabei werden lokale Änderungen verworfen.': 'Your draft is preserved. Review it before reloading; unsaved local changes will be discarded.',
  'Bitte versuche es erneut. Bereits gespeicherte Daten bleiben erhalten.': 'Please try again. Previously saved data will remain.',
  'Du bist offline. Änderungen benötigen eine Internetverbindung.': 'You are offline. Changes require an internet connection.',
  'Probleme mit der Anmeldung?': 'Trouble signing in?', 'Kein Zugang mehr? Nutze': 'Lost access? Use', 'die Passwortwiederherstellung': 'password recovery',
  'den Support': 'contact support', 'oder': 'or', 'Zwei-Faktor-Anmeldung': 'Two-factor authentication',
  'Authentikator verbinden': 'Connect authenticator', 'Wiederherstellungscodes jetzt sicher speichern': 'Save recovery codes securely now',
  'Eine Authenticator-App auf deinem Handy, zum Beispiel Google Authenticator, Microsoft Authenticator oder eine Passwort-App mit Einmalcodes.': 'An authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or a password manager with one-time codes.',
  'Gib den aktuellen sechsstelligen Code ein, den die App für EstateAtlas anzeigt.': 'Enter the current six-digit code shown for EstateAtlas in your app.',
  'Bestätige deine E-Mail-Adresse, um dein Portfolio zu öffnen. Prüfe dein Postfach oder fordere die Bestätigung erneut an.': 'Verify your email address to open your portfolio. Check your inbox or request another verification email.',
  'Dein Konto, eigene Immobilien und ihre Dokumente werden endgültig gelöscht. Fremde, mit dir geteilte Immobilien bleiben erhalten. Eigene geteilte Immobilien musst du vorher übertragen oder deren Freigaben entfernen.': 'Your account, properties you own and their documents will be permanently deleted. Properties shared with you by others will remain. Transfer your shared properties or remove their access before deletion.',
  'Sicher gespeichert': 'Saved securely',
  'Du kannst dein EstateAtlas-Konto selbst in der Web-App löschen. Melde dich an und öffne „Mein Konto → Konto löschen“.': 'You can delete your EstateAtlas account yourself in the web app. Sign in and open “My account → Delete account”.',
  'Exportiere deine Daten unter „Deine Daten mitnehmen“, wenn du eine Kopie behalten möchtest.': 'Export your data under “Export your data” if you want to keep a copy.',
  'Gib dein aktuelles Passwort, gegebenenfalls den Zwei-Faktor-Code und „KONTO LÖSCHEN“ ein.': 'Enter your current password, your two-factor code if enabled, and “DELETE ACCOUNT”.',
  'Bestätige die endgültige Löschung.': 'Confirm permanent deletion.',
  'Dein Konto, eigene Immobilien, Dateien und Zugänge werden aus der Live-Datenbank entfernt. Fremde Immobilien bleiben bestehen. Ältere Sicherungen können die Daten bis zur Rotation enthalten. Der letzte aktive Administrator muss zuerst einen weiteren Administrator einrichten.': 'Your account, properties you own, files and access will be removed from the live database. Other people’s properties remain. Older backups may retain the data until rotation. The last active administrator must first appoint another administrator.',
  'Mein Konto öffnen': 'Open my account', 'Erneut versuchen': 'Try again', 'Deine Daten mitnehmen': 'Export your data',
  'Dein Workspace mit einem eigenen Symbol auf dem Startbildschirm – ohne App Store.': 'Add your workspace to your home screen with its own icon — no app store required.',
  'Öffne dein Portfolio oder die Hilfe, um weiterzumachen.': 'Open your portfolio or help to continue.',
  'Nutze „Passwort vergessen“ auf der Anmeldeseite. Wenn Zwei-Faktor-Anmeldung aktiv ist, brauchst du zusätzlich den Code deiner Authenticator-App oder einen gespeicherten Wiederherstellungscode.': 'Use “Forgot password” on the sign-in page. If two-factor authentication is enabled, you will also need a code from your authenticator app or a saved recovery code.',
  'Installationsanleitung öffnen': 'Open installation guide', 'Fehler melden': 'Report an issue',
  'Nenne die betroffene Funktion, den ungefähren Zeitpunkt und die angezeigte Fehlermeldung. Schicke keine Passwörter, Anmeldecodes, API-Schlüssel oder privaten Dokumente.': 'Describe the affected feature, approximate time and error message. Do not send passwords, sign-in codes, API keys or private documents.',
  'Der öffentliche Supportkontakt wird vor der Veröffentlichung ergänzt.': 'The public support contact will be added before launch.',
  'Löschablauf ansehen': 'View deletion process', 'Linkcode': 'Link code', 'Zwei-Faktor- oder Wiederherstellungscode': 'Two-factor or recovery code',
  'Immobilien, einschließlich Archiv.': 'Properties, including archived ones.',
  'MB für Fotos und Dokumente. Geteilte Dateien zählen beim Eigentümer.': 'MB for photos and documents. Shared files count toward the owner’s storage.',
  'Nach der Änderung werden alle Sitzungen beendet.': 'All sessions will be signed out after this change.', 'Das brauchst du': 'What you need',
  'Authenticator verbinden': 'Connect authenticator',
  'Öffne die App, wähle „Konto hinzufügen“ und dann „Schlüssel manuell eingeben“. Nenne es EstateAtlas und trage den folgenden Einrichtungsschlüssel ein. Er ist kein Passwort und bleibt privat.': 'Open your authenticator app, choose “Add account” and then “Enter setup key”. Name it EstateAtlas and enter the setup key below. It is not a password; keep it private.',
  'Sechsstelliger Code': 'Six-digit code', 'Einrichtung bestätigen': 'Confirm setup', 'Zwei-Faktor-Anmeldung deaktivieren': 'Disable two-factor authentication',
  'Zuletzt aktiv:': 'Last active:', 'Beenden': 'Sign out', 'JSON-Archiv mit deinen eigenen Immobilien, Wertverläufen, Recherchen, Checklisten und Dokumenten. Dateien sind als Base64 enthalten.': 'JSON archive of properties you own, value histories, research, checklists and documents. Files are included as Base64.',
  'Zur Bestätigung: KONTO LÖSCHEN': 'Type DELETE ACCOUNT to confirm', 'Verwaltungskonten benötigen eine eingerichtete Zwei-Faktor-Anmeldung.': 'Admin accounts must have two-factor authentication enabled.',
  'Zurück zum Portfolio': 'Back to portfolio', 'Bestätigt': 'Verified', 'Unbestätigt': 'Unverified', 'Seite': 'Page',
  'Registriert': 'Registered', 'Leeres Konto endgültig löschen': 'Permanently delete empty account', 'Administrator': 'Administrator', 'Widerrufen': 'Revoke',
  'Öffnen ist erst mit verpflichtender E-Mail-Bestätigung und eingerichtetem Mailversand möglich. Deployment-Vorgaben haben Vorrang.': 'Opening is possible only after mandatory email verification and email delivery are configured. Deployment requirements take precedence.',
  'Änderungen nachvollziehen': 'Track changes',
  'Ich stimme zu, dass Adresse, Position und Objektmerkmale für diese Recherche an OpenAI und dessen Suchdienste übermittelt werden. API-Kosten fallen an.': 'I agree to send the address, location and property details to OpenAI and its search services for this research. API costs apply.',
  'Datensicherheit': 'Data security', 'Unsicherheiten & Berechnung': 'Uncertainty & calculation', 'TESTDATEN': 'TEST DATA',
  'Mietvertrag hinterlegt': 'Lease document stored',
  'Deine Auswahl bleibt in diesem Browser für dein Konto gespeichert. Filter gelten für alle sichtbaren Bereiche.': 'Your selection is saved in this browser for your account. Filters apply to all visible sections.',
  'Eigene Marktwertangaben': 'Your market value estimates', 'im Archiv': 'in archive', 'Länder': 'Countries',
  'Dein Portfolio auf der Karte': 'Your portfolio on the map', 'Immobilien ·': 'Properties ·', 'OpenStreetMap': 'OpenStreetMap',
  'Vergleichsangebote, nachvollziehbare Preisspannen und Quellen direkt bei deiner Immobilie.': 'Comparable listings, transparent price ranges and sources for each property.',
  'Testdaten laden': 'Load test data', 'Art': 'Type', '¹ Marktwerte sind deine Angaben, keine KI-Bewertung.': '¹ Market values are your own estimates, not AI valuations.',
  'Eine klare': 'A clear', 'Perspektive.': 'perspective.', 'Private Portfolios': 'Private portfolios', 'Web · Android · iOS': 'Web · Android · iOS',
  'ESTATEATLAS · DEIN PRIVATER IMMOBILIEN-WORKSPACE': 'ESTATEATLAS · YOUR PRIVATE PROPERTY WORKSPACE',
  'Objektangaben': 'Property details', 'Notizen': 'Notes', 'Optional speichern · JPEG, PNG, WebP oder PDF · bis 10 MB': 'Optional · JPEG, PNG, WebP or PDF · up to 10 MB',
  'Platz für alles Wichtige': 'Room for everything important', 'Alles zum Objekt. An einem Ort.': 'Everything about a property. In one place.',
  'Speichern bei': 'Save under', 'Dokumente (PDF)': 'Documents (PDF)', 'Fotos': 'Photos', 'Dokumente werden geladen …': 'Loading documents …',
  'Öffne EstateAtlas in Safari. Tippe auf „Teilen“ und dann „Zum Home-Bildschirm“. Bestätige mit „Hinzufügen“. Danach öffnest du EstateAtlas über das neue Symbol.': 'Open EstateAtlas in Safari. Tap “Share”, then “Add to Home Screen”. Confirm with “Add”. Open EstateAtlas from the new icon.',
  'Öffne EstateAtlas in einem Browser wie Chrome oder Edge. Wähle im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“. Falls dein Browser dies unterstützt, erscheint hier zusätzlich ein Installationsbutton.': 'Open EstateAtlas in a browser such as Chrome or Edge. In the browser menu, choose “Install app” or “Add to Home screen”. If supported, an install button also appears here.',
  'Die Web-App braucht eine Internetverbindung für Anmeldung, Immobilien und Dateien. Offline erscheint nur ein allgemeiner Hinweis. Die Installation speichert keine Kopie deiner Portfoliodaten.': 'The web app needs an internet connection for sign-in, properties and files. Offline, it shows only a general notice. Installing the app does not store a copy of your portfolio data.',
  'OpenStreetMap als Ersatzkarte geladen.': 'OpenStreetMap fallback map loaded.', 'Noch keine Verteilung': 'No allocation yet', 'Im Detail': 'Details',
  'Gruppe': 'Group', 'Anteile beschreiben deinen aktuellen Bestand. Sie sind keine Risikobewertung.': 'Shares describe your current portfolio. They are not a risk assessment.',
  'Zuletzt bewertet': 'Last valued', 'Archiv einblenden': 'Show archived', 'Aktueller Bestand ·': 'Current portfolio ·',
  'Immobilien in deiner Auswahl. Verläufe zeigen gespeicherte Wertangaben je Objekt; keine rückwirkende Gesamtbewertung. Archivobjekte zählen nicht zu den Summen. Der Zeitraum gilt für die Verläufe.': 'Properties in your selection. Histories show saved values for each property; they are not a retrospective portfolio valuation. Archived properties are excluded from totals. The period applies to all histories.',
  'Wertangaben werden geladen …': 'Loading valuations …', 'Details öffnen ↗': 'Open details ↗', 'Bezeichnung': 'Name',
  'Unbefristet': 'Ongoing', 'erfasst.': 'recorded.', 'Skala ab': 'Scale from', 'bis': 'to', 'Alle Wertangaben ansehen (': 'View all valuations (',
  'Gut vorbereitet zum nächsten Termin': 'Ready for your next appointment', 'Termin': 'Appointment', 'Punkt hinzufügen': 'Add item', 'Weitere Notizen': 'Additional notes',
  'DEIN KAUFSZENARIO': 'YOUR PURCHASE SCENARIO', 'Was kostet die Immobilie insgesamt?': 'What is the total cost of this property?',
  'Den Kauf durchrechnen': 'Calculate purchase costs', 'Die Immobilienwährung wurde geändert. Dieses Szenario bleibt in': 'The property currency has changed. This scenario remains in',
  '; für die neue Währung bitte einen neuen Kaufcheck erstellen.': '; create a new purchase check for the new currency.', 'Vermittlung': 'Agency fee',
  'Kaufcheck entfernen': 'Remove purchase check', 'Du hast': 'You have', 'für diese Immobilie. Freigaben verwaltet der Eigentümer.': 'for this property. The owner manages access.',
  'Gib den Code ein, den der Eigentümer mit dir geteilt hat.': 'Enter the code shared with you by the owner.',
  'Diese private Vorschau ist noch nicht öffentlich freigegeben. Die Betreiberangaben werden vor der Veröffentlichung ergänzt.': 'This private preview is not yet publicly available. Operator details will be added before launch.',
};

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function preferredLanguage(): Language {
  try {
    const saved = localStorage.getItem('estateatlas-language');
    if (saved === 'de' || saved === 'en') return saved;
  } catch { /* storage may be disabled */ }
  const browserLanguage = (navigator.languages?.[0] ?? navigator.language).toLowerCase();
  return browserLanguage.startsWith('en') ? 'en' : 'de';
}

export default function LanguageControl() {
  const [language, setLanguage] = useState<Language>('de');

  useEffect(() => {
    const sources = new WeakMap<Text, { source: string; rendered: string }>();
    const attrSources = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();
    const applyText = (node: Text, lang: Language) => {
      const current = node.data;
      const previous = sources.get(node);
      const source = previous && current === previous.rendered ? previous.source : current;
      if (!source.trim()) return;
      const translation = lang === 'en' ? translations[normalize(source)] : undefined;
      const rendered = translation ? source.replace(normalize(source), translation) : source;
      sources.set(node, { source, rendered });
      if (current !== rendered) node.data = rendered;
    };
    const applyElement = (element: Element, lang: Language) => {
      if (element.closest('[data-language-control]')) return;
      for (const attribute of ['placeholder', 'title', 'aria-label', 'alt']) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        let entries = attrSources.get(element);
        if (!entries) { entries = new Map(); attrSources.set(element, entries); }
        const previous = entries.get(attribute);
        const source = previous && current === previous.rendered ? previous.source : current;
        const rendered = lang === 'en' ? translations[normalize(source)] ?? source : source;
        entries.set(attribute, { source, rendered });
        if (current !== rendered) element.setAttribute(attribute, rendered);
      }
    };
    let active = preferredLanguage();
    setLanguage(active);
    const process = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) applyText(root as Text, active);
      if (root instanceof Element) applyElement(root, active);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) applyText(node as Text, active);
      if (root instanceof Element) root.querySelectorAll('*').forEach((element) => applyElement(element, active));
    };
    const updateLanguage = (next: Language) => {
      active = next;
      document.documentElement.lang = next;
      process(document.body);
      document.title = next === 'en' ? 'EstateAtlas · Your property portfolio' : 'EstateAtlas · Dein Immobilienportfolio';
      const description = document.querySelector('meta[name="description"]');
      if (description) description.setAttribute('content', next === 'en' ? translations['Deine Immobilien. Eine klare Perspektive. Private Portfolios auf Web, Android und iOS.'] : 'Deine Immobilien. Eine klare Perspektive. Private Portfolios auf Web, Android und iOS.');
    };
    updateLanguage(active);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') applyText(record.target as Text, active);
        for (const node of record.addedNodes) process(node);
        if (record.type === 'attributes' && record.target instanceof Element) applyElement(record.target, active);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'] });
    window.addEventListener('estateatlas-language-change', ((event: CustomEvent<Language>) => updateLanguage(event.detail)) as EventListener);
    return () => observer.disconnect();
  }, []);

  function choose(next: Language) {
    setLanguage(next);
    try { localStorage.setItem('estateatlas-language', next); } catch { /* preference remains for this page */ }
    window.dispatchEvent(new CustomEvent('estateatlas-language-change', { detail: next }));
  }

  return (
    <div className="language-control" data-language-control aria-label="Language / Sprache">
      <button type="button" onClick={() => choose('de')} aria-pressed={language === 'de'}>DE</button>
      <button type="button" onClick={() => choose('en')} aria-pressed={language === 'en'}>EN</button>
    </div>
  );
}

# PuntKlik

PuntKlik verstopt punten op ondersteunde Smartschool-puntenpagina's. Klik op een verstopt punt en tik 12 keer op de figuur. Pas na de twaalfde tik draaien de punten; daarna verschijnt het echte punt onderaan.

Na het tonen krijgt het punt een rarity en levert het coins op. De indeling is Common (0–49%, 1 coin), Uncommon (50–69%, 3), Rare (70–84%, 5), Epic (85–94%, 8), Legendary (95–99%, 12) en Mythic (100%, 20). Een punt levert maar één keer coins op. In de Figurenwinkel koop je een aardbei, muntblaadje, ster, watermeloen, sinaasappel, donut of cupcake. De gekozen figuur vervangt de startkoek op de klikknop. Alles wordt lokaal in Chrome bewaard.

De winkel opent als aparte extensiepopup. Je kunt daar drie toppings kopen, toevoegen of verwijderen: sprinkles (+10%), chocoladesaus (+25%) en goudstof (+50%). Actieve toppings stapelen; de afgeronde bonus wordt bij je coinbeloning opgeteld, met minstens 1 extra coin per punt zodra een topping actief is. Open **Instellingen** vanuit de winkel om het aantal tikken voor de spin in te stellen van 1 tot 50 (standaard 12) of PuntKlik aan/uit te zetten.

## Supabase-leaderboard instellen

Het leaderboard toont de top 10 aan ingelogde spelers. De coinstand wordt aan het Supabase-account gekoppeld, bij inloggen teruggezet en bij elke coinwijziging gesynchroniseerd, ook wanneer de winkelpopup gesloten is. De speler kiest zelf een nickname om openbaar in de ranglijst te verschijnen. E-mailadressen worden niet in de leaderboardtabel opgeslagen of aan andere spelers getoond.

1. Maak een Supabase-project aan.
2. Open **SQL Editor**, plak de bijgewerkte inhoud van `supabase-setup.sql` en voer die uit (voer deze opnieuw uit als je de eerdere SQL al had gedraaid). Het script vernieuwt op het einde ook de PostgREST-schema-cache, zodat nieuwe Supabase-functies meteen gevonden worden. Dit maakt of actualiseert de leaderboardtabel en RLS-policies: ingelogde gebruikers mogen de ranglijst lezen en hun eigen record wijzigen; het opgegeven owner-account mag alle records wijzigen.
3. Laad de uitgepakte extensie via `chrome://extensions` en kopieer het extensie-ID.
4. Configureer Google-login:
   - Open in Supabase **Authentication → Sign In / Providers → Google** en schakel Google in.
   - Maak in Google Cloud Console een OAuth-client van het type **Web application**. Voeg de callback-URL die Supabase op die Google-providerpagina toont toe aan **Authorized redirect URIs**.
   - Vul de Google-client-ID en client secret in bij de Google-providerinstellingen van Supabase.
   - Voeg bij Supabase **Authentication → URL Configuration → Redirect URLs** deze redirect toe: `https://<EXTENSIE-ID>.chromiumapp.org/supabase` (vervang `<EXTENSIE-ID>` door het ID uit `chrome://extensions`).
5. Vul in `supabase-config.js` de **Project URL** en de **publishable key** van Supabase in. Gebruik nooit een `secret`- of `service_role`-key in de extensie. De Project URL en publishable key zijn bedoeld voor clienttoepassingen; RLS beveiligt de tabel.
6. Laad de extensie opnieuw via `chrome://extensions`.

Daarna kan een speler in de winkel op **Inloggen met Google** klikken en zelf een nickname kiezen. De login gebruikt Supabase Auth met PKCE; de extensie bewaart de Supabase-sessie lokaal in Chrome. De leaderboardtabel bevat de user-ID, nickname, coinstand en bijwerktijd; aparte Supabase-tabellen bewaren promo-instellingen, secret-shopitems en accountgebonden aankopen/effecten. E-mailadressen staan niet in de leaderboardtabel.

Het bevestigde account `victorerauw@sint-jozefsinstituut.be` krijgt ownerrechten nadat de bijgewerkte SQL is uitgevoerd. Na inloggen met dat Google-account verschijnt **Ownerbeheer** in de winkel. Daar kan de owner nicknames en scores van spelers aanpassen. De database controleert deze rechten met RLS; de extensie verbergt alleen de beheerinterface voor andere accounts.

In **Ownerbeheer** kan de owner een promo starten (percentagekorting, 1–1.440 minuten; maximaal 5 coins korting per item), de secret shop openen/sluiten en zeven tijdelijke events starten: dubbele coins, coinbonus per account, muntjesregen (klik op vallende zakjes voor de ingestelde coins), flash sale op een gekozen item, lucky drops, een persoonlijke puntenchallenge of een thema-event. Eventduur, kans, beloning en doel zijn instelbaar. Tijdens elk actief event kan de owner iedereen één ownerfruit geven; dit geeft +60% coins tot het event eindigt. Coinbonussen en challengebeloningen vereisen een ingelogd account; een coinbonus kan worden opgehaald zolang het event actief is. Een challenge telt unieke punten per account en beloont maximaal één keer. Tijdens een promo of flash sale krijgen de betrokken winkelitems een badge. Het event-icoon linksonder toont actieve events, inclusief wie ze startte en wanneer. Secret-shopitems krijgen een naam, beschrijving, emoji/badge, coinprijs en één effect: permanent cosmetic collectible, bonuscoins per punt voor maximaal 24 uur, of extra winkelkorting voor maximaal 24 uur. Tijdelijke items zijn accountgebonden; cosmetics kunnen per speler één keer worden gekocht. De aankoop en coin-aftrek gebeuren samen in een Supabase-functie.

De owner kan ook een global announcement sturen met een naam en bericht van maximaal 1.000 tekens. De popup en open Smartschool-puntenpagina's controleren op nieuwe meldingen en tonen ze als `Naam: bericht` gedurende maximaal 5 seconden. Activaties van store-events verschijnen ook als korte melding op open Smartschool-puntenpagina's. Omdat Chrome de popup sluit wanneer je erbuiten klikt, ziet iemand de popupmelding alleen als de popup open is wanneer die wordt verzonden.

In Ownerbeheer kan de owner een naam en toekomstige startdatum/-tijd voor het owner-event instellen of de counter wissen. De popup toont voor iedereen de resterende dagen, uren, minuten en seconden; zodra de tijd bereikt is, verandert dit in **Het event is begonnen!**.

Dit is een casual ranglijst: coins worden lokaal verdiend en de client rapporteert de balans. Een speler die de extensie aanpast kan dus een onjuiste score insturen. RLS en tabelchecks beperken wie records kan wijzigen en de recordvorm, maar maken de coinstand niet cheat-proof.

PuntKlik gebruikt alleen cijfers die al op de geopende Smartschool-pagina staan. Het haalt geen verborgen cijfers op, gebruikt geen Smartschool-API en wijzigt niets aan je account.

## Installeren in Chrome

1. Open `chrome://extensions`.
2. Schakel **Ontwikkelaarsmodus** in.
3. Kies **Uitgepakte extensie laden**.
4. Selecteer de map `smartschool-punten-case-opener`.
5. Klik op het PuntKlik-pictogram voor de winkel; open **Instellingen** om de kliklimiet aan te passen.
6. Ga naar een Smartschool-puntenpagina en klik op een verstopt punt.

PuntKlik scant alleen pagina's waarvan het adres op punten, resultaten of `skore` lijkt. Smartschool-pagina's kunnen verschillen; controleer na installatie of de punten goed herkend worden. Als instellingen niet geladen kunnen worden, laat PuntKlik de cijfers zichtbaar.

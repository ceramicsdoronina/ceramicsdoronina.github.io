# Ceramics Doronina – Sito statico + Stripe Checkout

Il sito è statico (GitHub Pages) con carrello locale nel browser. Il pagamento usa **Stripe Checkout**
tramite una funzione serverless Netlify che vive in un **repository separato**.

## Architettura (due repository)
- **Sito**: questa repo (GitHub Pages, dominio in `CNAME`). Punto d'ingresso: `index.html`.
  - Pagine di ritorno da Stripe: `stripe-success.html` e `stripe-cancel.html`.
  - JS: `Stripe/js/` (`util.js`, `money.js`, `liveCatalogue.js`, `cart.js`, `catalogueStripe.js`, `uiStripe.js`, `appStripe.js`, `importerStripe.js`) più `masterclass.js`, `certificati.js`, `i18n.js`, `messages.js` nella radice. `cart.js` contiene la logica pura del carrello (testata in Node); `uiStripe.js` è lo strato DOM/localStorage. SheetJS (per gli ODS) è caricato in modo asincrono da `index.html` e non blocca il resto della pagina: se non arriva entro 15 s, le sole griglie dati mostrano "non disponibile".
  - Partial HTML caricati da `index.html`: `Stripe/partials/`.
- **Funzione**: l'unica funzione distribuita sta nella repo separata **`ceramicsdoronina.netifly`** (il nome della cartella contiene un refuso: "netifly" invece di "netlify"), file `functions/create-checkout.js`. Non esiste più nessuna copia della funzione in questa repo.

## Endpoint
L'endpoint è l'URL assoluto di Netlify, definito in un solo punto: `window.CD.config.checkoutEndpoint` in `index.html`.
Modifica quel valore se cambi sito Netlify.
Lo stesso blocco contiene `catalogueEndpoint` (`.../.netlify/functions/catalogue`, lettura pubblica): i due URL vanno tenuti allineati (stesso dominio) in `index.html` e qui.

## Catalogo dal Google Sheet (endpoint versione 2) e fallback ODS
- Il catalogo vive nel Google Sheet (fogli `Vasi`, `Masterclass`, `Certificati`, stesse intestazioni degli ODS). La funzione `catalogue` risponde (CORS `*`, cache 60 s) con `version: 2`: `items` (id, prezzo in centesimi, venduto, come nella versione 1) e `tabs.vasi|masterclass|certificati` = `{headers, rows}` con le righe come stringhe del foglio (`venduto` dei vasi già con lo stato effettivo `si`/`no`), oppure `null` per il foglio che la funzione serve da snapshot.
- Flusso dati (`importerStripe.js` / `appStripe.js` / `liveCatalogue.js`): gli ODS e l'endpoint partono in parallelo. Per ogni foglio: se l'endpoint porta le righe, il sito rende quelle; se il foglio è `null`, non valido o l'endpoint non risponde (timeout 5 s, HTTP non 200, JSON non valido: solo `console.warn`, nessun avviso al visitatore), si usa il corrispondente ODS in `catalogue/`. Scelta per foglio in `liveCatalogue.chooseData`.
- Forma delle righe: una sola funzione di conversione (`util.normalizeRow`) serve sia `loadOdsRows` sia il percorso endpoint, quindi il rendering (`catalogueStripe.js`, `masterclass.js`, `certificati.js`) non sa da dove vengono le righe. Valori tagliati (trim), `-` e vuoti invariati (li interpreta il rendering), colonne non intestate scartate. Le righe del foglio non hanno `<col>__raw` (solo l'ODS conosce il tipo numerico della cella): i prezzi si leggono dal testo con `money.js`, stessi centesimi.
- Dati non fidati: il testo del foglio passa dallo stesso `escapeHtml` dei dati ODS in tutti i template. Righe scartate: non oggetti, `id` mancante/non valido/duplicato; un foglio con righe ma nessuna valida, o senza le colonne minime, è considerato non valido (si usa l'ODS). I nomi immagine (`img1`...`img6`) sono semplici nomi file: con barre, `\` o `..` il valore diventa vuoto (segnaposto); il prefisso della cartella lo mette il sito.
- Regola "venduto": valgono i valori letti dal rendering come per l'ODS (`si`, `sì`, `yes`, `sold`, `1`... = venduto; `no`, vuoto o altro = in vendita).
- Overlay versione 1 (`applyOverlay`): serve solo quando i VASI vengono dall'ODS di riserva e l'endpoint porta `items`; mai sulle righe che arrivano dal foglio (niente doppia applicazione). Un payload versione 1 (senza `tabs`) funziona come prima: tutti i fogli da ODS + overlay prezzi/venduto.
- Primo render: appena gli ODS sono pronti, oppure appena l'endpoint copre tutti e tre i fogli (allora non si aspetta né gli ODS né SheetJS). Se l'endpoint arriva dopo il primo render il sito ri-rende con la lingua corrente, riapre i modali aperti e riallinea il carrello.
- **Gli ODS restano nel repo come fallback finché la titolare non conferma che il foglio è stabile; dopo la conferma si possono eliminare** (e con loro il caricamento di SheetJS in `index.html`, `loadOdsRows` e i `loadRows` dei moduli).
- Test: `node --test test/*.test.js` (parità ODS/foglio con `test/fixtures/`; i valori attesi dell'ODS sono generati da `test/tools/ods_to_expected.py` perché SheetJS non è disponibile offline).
- Il pagamento non cambia: il prezzo addebitato lo decide sempre il server.

## Variabili d'ambiente e stato "venduto" (README della funzione = fonte canonica)
L'elenco completo e aggiornato delle variabili d'ambiente (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ALLOWED_ORIGINS`, `SITE_URL`, `OWNER_NOTIFY_WEBHOOK_URL`, ...), la procedura "vendo un vaso / cambio un prezzo" e la checklist pre-lancio stanno nel README della repo `ceramicsdoronina.netifly`: qui non si ripetono per non farli divergere. In sintesi: i segreti vivono solo in Netlify, mai nel codice.

## Webhook (solo puntatore)
Il webhook Stripe è `/.netlify/functions/stripe-webhook` sul sito Netlify (verifica la firma sul corpo grezzo e avvisa la titolare). Variabile `OWNER_NOTIFY_WEBHOOK_URL`, eventi da sottoscrivere in Stripe (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`) e checklist: vedi README della funzione. Senza canale di notifica configurato la titolare NON riceve nessun avviso d'ordine.

## Contratto client → funzione
Richiesta `POST` JSON:

```json
{ "items": [ { "id": "v1", "quantity": 1 } ], "locale": "it" }
```

- `locale` è `it`, `en` oppure `ru` (lingua corrente del sito).
- Il client **non** invia prezzi, nomi, valuta, immagini, tipo, spedizione né metadati: li decide il server.
- Risposta `200`: `{ "url": "https://checkout.stripe.com/...", "session_id": "cs_..." }`. Il client reindirizza solo a URL che iniziano con `https://checkout.stripe.com/`.
- Esempio `200`: `{ "url": "https://checkout.stripe.com/...", "session_id": "cs_...", "request_id": "..." }`.
- Errore: `{ "error": "...", "request_id": "..." }`; con i `400` per un articolo (`unknown_item`, `item_sold`, `quantity_too_high`, `invalid_quantity` e, per le masterclass, `not_enough_seats`, `sold_out`, `group_size_unavailable`) c'è anche `item_id`. Con `400` e `item_id` il sito toglie quella riga dal carrello (e, per `item_sold` / `sold_out`, segna l'articolo venduto fino al prossimo ricaricamento), mostra "alcuni articoli non sono più disponibili" (per le tre cause masterclass un messaggio dedicato: posti insufficienti / completo / gruppo non disponibile) e ridisegna; con `400` senza `item_id` mostra "articolo non più disponibile"; con ogni altro errore, un messaggio generico.
- La sessione Stripe scade dopo 31 minuti (`expires_at`).
- Prima del redirect il client aggiunge alla mappa `cd_checkout_pending` la voce `{ "<session_id>": { ids, ts } }` (le voci più vecchie di 24 h vengono eliminate alla scrittura). `stripe-success.html` rimuove dal carrello solo gli id di QUELLA sessione e solo la sua voce; un `session_id` che non corrisponde non cambia nulla. `stripe-cancel.html` non cancella nulla (l'URL di annullo non contiene il `session_id`).
- La pagina di successo non ha più redirect automatico, mostra un riferimento d'ordine breve (ultimi 8 caratteri del `session_id`) e promette solo ciò che esiste: ricevuta di Stripe via email e contatto della titolare per la consegna. Per questo, in Stripe Dashboard > Settings > Emails va abilitato l'invio delle ricevute ai clienti (voce della checklist pre-lancio).

## Catalogo lato server (prezzi)
I prezzi usati da Stripe vengono dal `catalogue.json` della funzione, **non** dal sito. Il sito mostra i prezzi letti dal foglio (o dagli ODS di riserva) solo per visualizzazione. Con il passaggio al Google Sheet la fonte canonica è il foglio; finché gli ODS restano nel repo vanno tenuti allineati.
Dopo ogni modifica agli ODS in `catalogue/` (`vasi.ods`, `masterclass.ods`, `certificati.ods`):
1. Rigenera il catalogo con `tools/build-catalogue.py` nella repo `ceramicsdoronina.netifly` e verifica con `python3 -B -I tools/build-catalogue.py --check` (procedura completa nel README della funzione).
2. `functions/sold.json` nella funzione è solo un override manuale d'emergenza: la visualizzazione del sito segue SOLO il foglio (o l'ODS di riserva), quindi se si usa `sold.json` va impostato anche `venduto` = `si` lì (altrimenti il sito continua a mostrare "Compra" e il cliente riceve un errore al checkout, che toglie la riga dal carrello).
3. Pubblica entrambe le repo.

Mappatura: `price_new` (vasi) / `price` (masterclass) / `amount_eur` (carte regalo) → `priceCents` nel sito → prezzo server nel `catalogue.json`. `venduto` = `si` → articolo venduto (non acquistabile).
I file `catalogue/shipping.ods`, `catalogue/vasi.xlsx` e `catalogue/vasi.1.csv` sono copie obsolete: non vengono letti dal sito (non cancellati, in attesa della titolare).

## Quantità
- Vasi (pezzi unici): il sito accetta una sola unità per vaso (un secondo "Compra" sullo stesso vaso non fa nulla e avvisa) e la funzione impone quantità 1 (`maxQty`).
- Masterclass: `quantity` = PERSONE (1..8, vedi "Masterclass: prenotazione per persone"). Carte regalo: massimo 10.
- Al caricamento il carrello salvato viene riallineato al catalogo: articoli sconosciuti o venduti vengono rimossi con un avviso (la riconciliazione è saltata se un partial o un catalogo non si è caricato).
- Masterclass: gli eventi con data passata (fuso Europe/Rome, visibili fino a fine giornata dell'ultima data se c'è un intervallo) non sono mostrati né acquistabili. Date accettate: `dd.mm.yyyy`, `dd/mm/yyyy`, `yyyy-mm-dd`; una data non interpretabile lascia l'evento visibile e scrive un avviso in console. Se non resta nessuna data, la sezione mostra un messaggio "nessuna data in programma" con il solito pulsante "Scrivimi" e nasconde la frase "scegli una data".
- Prezzi mostrati con un unico formattatore (`CD.money.format`): it/ru `120 €` / `120,50 €`, en `€120` / `€120.50`.

## Masterclass: prenotazione per persone
- Una prenotazione è per N persone (1..8). Nel carrello la riga è `{id, quantity: N}` con `quantity` = PERSONE; il checkout invia `{id, quantity}` invariato e il server calcola l'INTERA prenotazione dal prezzo del gruppo N come UNA riga (il client non invia mai prezzo unitario x quantità per una masterclass).
- Prezzi a gruppo: colonne `price_1..price_8` del foglio (totale per quel numero di persone, non lineare; cella vuota = gruppo non offerto). Esempio: 1 persona 100, 2 persone 180. Due prenotazioni separate (due checkout) da 1 persona costano 100 + 100; aggiungere la stessa masterclass due volte al carrello SOMMA le persone (1 + 1 = 2 persone = 180), entro il massimo.
- Posti: `seats_total`, `seats_booked` (e `seats_free` calcolata dalla funzione). Posti liberi = il minore fra `seats_free` e `seats_total - seats_booked`; `seats_total` vuoto = 8. 8 prenotati su 8 = 0 liberi: badge "Completo", niente selettore né pulsante di prenotazione. Persone prenotabili = min(8, posti liberi, gruppo più grande offerto); il selettore elenca solo i gruppi offerti entro quel limite e mostra il TOTALE del gruppo e il prezzo a persona (es. "Totale 180 € (90 € a persona)", a persona arrotondato al centesimo).
- Titoli (e testi short/long) opzionali per lingua: lingua corrente, poi it, en, ru.
- Carrello: il prezzo della riga (drawer e totale) è il prezzo del gruppo N (`CD.cart.lineTotalCents` / `cartTotalCents`, stessi gruppi del server); nel drawer le persone si cambiano con un selettore. La riconciliazione limita le persone ai posti liberi e al gruppo offerto più vicino per difetto, toglie la riga se esaurita o se non c'è più nessun gruppo, e mostra la nota "prenotazione ridotta" (o quella "articoli non più disponibili").
- Selezione persone: ricordata per id fra un rendering e l'altro (cambio lingua, dati live arrivati dopo il primo render, modale riaperto).
- LEGACY: finché il foglio live non è migrato (e per l'ODS `catalogue/masterclass.ods`, colonne `...,date,time,level,spots,price,img1`) le righe non hanno `price_1` / `seats_total`: i prezzi sono lineari (N x `price`), i posti sono la prima cifra di `spots` (testo tipo "Max 6 persone", default 6, massimo 8), nessun conteggio dei prenotati e al posto del badge si mostra il testo di `spots`. La validazione del foglio accetta sia `price_1` sia `price`. Fixture di test: `test/fixtures/catalogue-tab-Masterclass-v2.csv` (schema nuovo) e `catalogue-tab-Masterclass.csv` (legacy).
- Il sito calcola i gruppi dalle righe del foglio (`tabs.masterclass.rows`); i campi calcolati dalla funzione in `items[]` (`tiersCents`, `seatsFree`, ...) non sono usati dal client: il server resta l'unica fonte di verità per l'addebito.

## Spedizione (come implementata ora)
Sulla somma dei soli articoli fisici: 40 EUR sotto 200 EUR, 20 EUR da 200 EUR fino a 499,99 EUR, 0 EUR da 500 EUR. Gli articoli digitali (masterclass, carte regalo) non pagano spedizione.
Paesi: UE + NO + CH – elenco da confermare con la titolare. **Il testo "spediamo in..." (`detail.deliveryText` in `messages.js`, it/en/ru) e `ALLOWED_COUNTRIES` nella funzione devono cambiare insieme.**

## localStorage
- `cd_stripe_cart_v1` – carrello (righe `{id, quantity, ...}`; nome/prezzo/immagine solo per visualizzazione).
- `cd_lang` – lingua (`it`, `en`, `ru`).
- `cd_view` – modalità `mobile` o `desktop`.
- `cd_cookie_consent_v1` – consenso cookie.
- `cd_checkout_pending` – mappa dei checkout in corso `{"<session_id>": {ids, ts}}`; la pagina di successo elimina solo la voce della propria sessione, la pagina di annullo non elimina nulla, le voci > 24 h sono potate alla scrittura.

## Test
- Sito: `node --test test/*.test.js` (Node 20+; con Node 22+ non passare la cartella `test/` da sola). Copre parser euro, formattatore, date evento, logica del carrello (`cart.js`), parità delle chiavi it/en/ru e controlli statici sull'ordine degli script. CI: `.github/workflows/test.yml`.
- Casi prezzo condivisi con la funzione: `test/fixtures/price-cases.json` (usato anche dal test python di `cents()` nella repo della funzione).
- Funzione (checkout, webhook, catalogo): vedi i test e il README nella repo `ceramicsdoronina.netifly`.

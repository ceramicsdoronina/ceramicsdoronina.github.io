# Ceramics Doronina – Sito statico + Stripe Checkout

Il sito è statico (GitHub Pages) con carrello locale nel browser. Il pagamento usa **Stripe Checkout**
tramite una funzione serverless Netlify che vive in un **repository separato**.

## Architettura (due repository)
- **Sito**: questa repo (GitHub Pages, dominio in `CNAME`). Punto d'ingresso: `index.html`.
  - Pagine di ritorno da Stripe: `stripe-success.html` e `stripe-cancel.html`.
  - JS: `Stripe/js/` (`util.js`, `money.js`, `catalogueStripe.js`, `uiStripe.js`, `appStripe.js`, `importerStripe.js`) più `masterclass.js`, `certificati.js`, `i18n.js`, `messages.js` nella radice.
  - Partial HTML caricati da `index.html`: `Stripe/partials/`.
- **Funzione**: l'unica funzione distribuita sta nella repo separata **`ceramicsdoronina.netifly`** (il nome della cartella contiene un refuso: "netifly" invece di "netlify"), file `functions/create-checkout.js`. Non esiste più nessuna copia della funzione in questa repo.

## Endpoint
L'endpoint è l'URL assoluto di Netlify, definito in un solo punto: `window.CD.config.checkoutEndpoint` in `index.html`.
Modifica quel valore se cambi sito Netlify.

## Variabili d'ambiente (Netlify, mai nel codice)
- `STRIPE_SECRET_KEY` – secret key Stripe (test o live).
- `STRIPE_WEBHOOK_SECRET` – segreto di firma del webhook Stripe.
- `ALLOWED_ORIGINS` – origini del sito ammesse (apex e www, senza slash finale).
- `SITE_URL` – URL base del sito usato per success/cancel e immagini (default `https://ceramicsdoronina.it`).

## Contratto client → funzione
Richiesta `POST` JSON:

```json
{ "items": [ { "id": "v1", "quantity": 1 } ], "locale": "it" }
```

- `locale` è `it`, `en` oppure `ru` (lingua corrente del sito).
- Il client **non** invia prezzi, nomi, valuta, immagini, tipo, spedizione né metadati: li decide il server.
- Risposta `200`: `{ "url": "https://checkout.stripe.com/...", "session_id": "cs_..." }`. Il client reindirizza solo a URL che iniziano con `https://checkout.stripe.com/`.
- Errore: `{ "error": "...", "request_id": "..." }`. Con `400` il sito mostra "articolo non più disponibile"; con ogni altro errore, un messaggio generico.
- Prima del redirect il client salva `{session_id, ids}` in `cd_checkout_pending`; `stripe-success.html` rimuove dal carrello solo quelle righe, e solo se il `session_id` nell'URL coincide.

## Catalogo lato server (prezzi)
I prezzi usati da Stripe vengono dal `catalogue.json` della funzione, **non** dal sito. Il sito mostra i prezzi letti dagli ODS solo per visualizzazione.
Dopo ogni modifica agli ODS in `catalogue/` (`vasi.ods`, `masterclass.ods`, `certificati.ods`):
1. Rigenera il catalogo con `tools/build-catalogue.py` nella repo `ceramicsdoronina.netifly`.
2. Aggiorna anche lì gli articoli venduti (`venduto` = `si` negli ODS e l'elenco dei venduti nella funzione).
3. Pubblica entrambe le repo.

Mappatura: `price_new` (vasi) / `price` (masterclass) / `amount_eur` (carte regalo) → `priceCents` nel sito → prezzo server nel `catalogue.json`. `venduto` = `si` → articolo venduto (non acquistabile).
I file `catalogue/vasi.xlsx` e `catalogue/vasi.1.csv` sono copie obsolete: non vengono letti dal sito.

## Quantità
- Vasi (pezzi unici): il sito accetta una sola unità per vaso (un secondo "Compra" sullo stesso vaso non fa nulla e avvisa) e la funzione deve imporre quantità 1.
- Masterclass: massimo = posti indicati in `spots` (altrimenti 6). Carte regalo: massimo 10.
- Al caricamento il carrello salvato viene riallineato al catalogo: articoli sconosciuti o venduti vengono rimossi con un avviso.

## Spedizione (come implementata ora)
Sulla somma dei soli articoli fisici: 40 EUR sotto 200 EUR, 20 EUR da 200 EUR fino a 499,99 EUR, 0 EUR da 500 EUR. Gli articoli digitali (masterclass, carte regalo) non pagano spedizione.
Paesi: UE + NO + CH – elenco da confermare con la titolare.

## localStorage
- `cd_stripe_cart_v1` – carrello (righe `{id, quantity, ...}`; nome/prezzo/immagine solo per visualizzazione).
- `cd_lang` – lingua (`it`, `en`, `ru`).
- `cd_view` – modalità `mobile` o `desktop`.
- `cd_cookie_consent_v1` – consenso cookie.
- `cd_checkout_pending` – checkout in corso `{session_id, ids, ts}`; viene eliminato dalle pagine di ritorno.

## Test
- `node --test test/money.test.js` – prova il parser euro → centesimi.

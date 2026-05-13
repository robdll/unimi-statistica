# Interactive Learning · Superhero Data Science

Una versione interattiva del corso *"Superhero Data Science Vol. 1: probabilità e statistica"* di **Dario Malchiodi**, pensata per studio in autonomia.

Ogni lezione è una pagina HTML autonoma che combina:

- **teoria** parafrasata e organizzata in sezioni brevi,
- **codice Python eseguibile direttamente nel browser** (via [Pyodide](https://pyodide.org/), Python compilato in WebAssembly),
- **quiz a risposta multipla** con feedback immediato,
- **esercizi guidati** con soluzione mostrabile a richiesta,
- una piccola **TOC** laterale con scroll-spy e barra di progresso.

## Struttura

```
interactive-learning/
├── index.html          # hub con l'elenco delle lezioni
├── lezione-01.html     # L01 — Introduzione a Python
├── lezione-02.html     # L02 — Pandas: Series & DataFrame
├── lezione-03.html     # L03 — Dati e frequenze
├── lezione-04.html     # L04 — Indici di dispersione
├── lezione-05.html     # L05 — Eterogeneità & concentrazione
├── lezione-06.html     # L06 — Trasformazione dei dati
├── lezione-07.html     # L07 — Analisi della varianza
├── lezione-08.html     # L08 — Analisi di classificatori
├── lezione-09.html     # L09 — Calcolo combinatorio
├── lezione-10.html     # L10 — Naive Bayes
├── lezione-11.html     # L11 — Distribuzione geometrica
├── lezione-12.html     # L12 — Ripasso integrato
├── assets/
│   ├── styles.css      # stile condiviso (dark + light)
│   └── app.js          # Pyodide loader, code playground, quiz, esercizi
└── README.md
```

## Come aprirlo

I browser non eseguono direttamente le pagine se aperte da `file://` (Pyodide ha bisogno di servire i wasm via HTTP). Bastano due secondi con un server statico:

### Opzione A — Python (già installato sul Mac)

```bash
cd interactive-learning
python3 -m http.server 8000
```

Poi apri http://localhost:8000

### Opzione B — Node (se hai npx)

```bash
npx serve interactive-learning
```

### Opzione C — Estensione "Live Server" di VS Code / Cursor

Click destro su `index.html` → *Open with Live Server*.

## Lezioni disponibili

| ID    | Titolo                                          | Stato            |
|-------|-------------------------------------------------|------------------|
| L01   | Introduzione a Python                           | ✅ Disponibile    |
| L02   | Pandas: Series &amp; DataFrame                  | ✅ Disponibile    |
| L03   | Dati e frequenze                                | ✅ Disponibile    |
| L04   | Indici di dispersione                           | ✅ Disponibile    |
| L05   | Eterogeneità &amp; concentrazione               | ✅ Disponibile    |
| L06   | Trasformazione dei dati                         | ✅ Disponibile    |
| L07   | Analisi della varianza                          | ✅ Disponibile    |
| L08   | Analisi di classificatori                       | ✅ Disponibile    |
| L09   | Calcolo combinatorio                            | ✅ Disponibile    |
| L10   | Naive Bayes                                     | ✅ Disponibile    |
| L11   | Distribuzione geometrica                        | ✅ Disponibile    |
| L12   | Ripasso integrato (Poisson, esponenziale, TCL)  | ✅ Disponibile    |

## Aggiungere una nuova lezione

1. Crea un nuovo file `lezione-NN.html` partendo dal template di `lezione-01.html`.
2. Aggiungi una `lesson-card` nella sezione *Lezioni* di `index.html` (rimuovi la classe `disabled` quando è pronta).
3. Per inserire un blocco di codice eseguibile usa:

   ```html
   <pre data-runnable data-title="esempio.py" data-lang="python">
   print("ciao")
   </pre>
   ```

   Attributi opzionali per il caricamento on-demand di pacchetti Pyodide:

   - `data-matplotlib="true"` — numpy + matplotlib (con backend AGG per grafici inline);
   - `data-pandas="true"` — pandas;
   - `data-scipy="true"` — scipy (e `scipy.stats`);
   - `data-sklearn="true"` — scikit-learn;
   - `data-statsmodels="true"` — statsmodels (es. per `sm.qqplot`);
   - `data-pkgs="numpy,scipy"` — elenco generico di pacchetti separati da virgola;
   - `data-autorun="true"` — esegue il blocco appena la lezione è pronta.

4. Per un quiz a risposta multipla:

   ```html
   <div class="quiz">
     <h4>Domanda?</h4>
     <ul class="quiz-options">
       <li>Sbagliata</li>
       <li data-correct>Giusta</li>
       <li>Sbagliata</li>
     </ul>
     <div class="quiz-explain">Spiegazione mostrata dopo la verifica.</div>
   </div>
   ```

5. Per un esercizio (con eventuale soluzione nascosta):

   ```html
   <div class="exercise">
     <h4>Esercizio</h4>
     <p>Testo dell'esercizio…</p>
     <pre data-runnable data-title="esercizio.py" data-lang="python">
# scrivi la soluzione qui
     </pre>
     <div class="solution">
       <pre data-runnable data-title="soluzione.py" data-lang="python">
# soluzione di riferimento
       </pre>
     </div>
   </div>
   ```

## Note tecniche

- **Pyodide è caricato in lazy** alla prima esecuzione di un blocco di codice. Le esecuzioni successive sono istantanee.
- I grafici di **matplotlib** sono salvati come PNG (backend AGG) e visualizzati inline.
- Tutto gira lato client: nessun dato lascia il browser.
- Le impostazioni del tema (chiaro/scuro) sono persistite in `localStorage`.

## Licenza

I contenuti didattici riprendono *D. Malchiodi, Superhero Data Science Vol. 1* (CC BY-NC-ND 4.0). Questa rielaborazione mantiene la stessa licenza.

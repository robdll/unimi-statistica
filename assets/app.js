/* =========================================================
 * Interactive Learning – Superhero Data Science
 * Funzionalità condivise:
 *   - Caricamento lazy di Pyodide (Python in WebAssembly)
 *   - Esecuzione di blocchi di codice Python interattivi
 *   - Sistema di quiz a risposta multipla con feedback
 *   - Componente esercizi (verifica + soluzione)
 *   - Toggle del tema (dark/light)
 *   - Indicatore di caricamento Python
 *   - Tracker di progresso lezione
 * =========================================================
 *
 * Hosting: serve la cartella con un server statico (vedi README).
 * Pyodide viene caricato dal CDN ufficiale solo al primo "Run".
 */

(function () {
  "use strict";

  /* ---------------- Configurazione ---------------- */

  const PYODIDE_VERSION = "0.26.4";
  const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

  /* ---------------- Stato globale ---------------- */

  const state = {
    pyodide: null,
    pyodideLoading: null,
    matplotlibPatched: false,
    matplotlibPackages: ["matplotlib", "numpy"],
    pyodideStatusEl: null,
  };

  /* ---------------- Helpers DOM ---------------- */

  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $$(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "style") Object.assign(node.style, v);
      else if (k.startsWith("on") && typeof v === "function")
        node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  /* ---------------- Pyodide loader ---------------- */

  function ensurePyodideStatus() {
    if (state.pyodideStatusEl) return state.pyodideStatusEl;
    const elx = el("div", { class: "pyodide-status", role: "status", "aria-live": "polite" },
      el("span", { class: "dot" }),
      el("span", { class: "label" }, "Python in caricamento…")
    );
    document.body.appendChild(elx);
    state.pyodideStatusEl = elx;
    return elx;
  }

  function setStatus(text, kind = "loading") {
    const elx = ensurePyodideStatus();
    elx.classList.remove("ready", "error", "fade");
    if (kind === "ready") elx.classList.add("ready");
    if (kind === "error") elx.classList.add("error");
    elx.querySelector(".label").textContent = text;
    if (kind === "ready") {
      clearTimeout(elx._fadeTimer);
      elx._fadeTimer = setTimeout(() => elx.classList.add("fade"), 2200);
    }
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-src="${src}"]`)) {
        return resolve();
      }
      const s = document.createElement("script");
      s.src = src;
      s.dataset.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadPyodide() {
    if (state.pyodide) return state.pyodide;
    if (state.pyodideLoading) return state.pyodideLoading;

    setStatus("Caricamento Python (Pyodide)…");

    state.pyodideLoading = (async () => {
      try {
        await loadScriptOnce(PYODIDE_CDN);
        // eslint-disable-next-line no-undef
        const pyodide = await window.loadPyodide({
          indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
        });
        state.pyodide = pyodide;
        setStatus("Python pronto", "ready");
        return pyodide;
      } catch (err) {
        console.error(err);
        setStatus("Errore: Python non disponibile", "error");
        throw err;
      }
    })();

    return state.pyodideLoading;
  }

  /* Carica matplotlib + numpy on-demand, e configura un backend non-interattivo
     che salva la figura come PNG (base64) recuperabile da JS. */
  async function ensureMatplotlib(pyodide) {
    if (state.matplotlibPatched) return;
    setStatus("Caricamento matplotlib + numpy…");
    await pyodide.loadPackage(state.matplotlibPackages);
    await pyodide.runPythonAsync(`
import matplotlib
matplotlib.use("AGG")
import matplotlib.pyplot as _plt
import io as _io, base64 as _b64

_il_plot_outputs = []

def _il_capture_show(*a, **k):
    fig = _plt.gcf()
    if not fig.get_axes():
        return
    buf = _io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=120)
    buf.seek(0)
    data = _b64.b64encode(buf.read()).decode("ascii")
    _il_plot_outputs.append(data)
    _plt.close(fig)

_plt.show = _il_capture_show
    `);
    state.matplotlibPatched = true;
    setStatus("Python pronto", "ready");
  }

  /* ---------------- Code playground ---------------- */

  /* Trasforma un <pre data-lang="python" data-runnable> in un editor interattivo. */
  function buildPlayground(pre) {
    const initialCode = pre.textContent.replace(/\n$/, "");
    const title = pre.dataset.title || "esempio.py";
    const autoRun = pre.dataset.autorun === "true";
    const needsMatplotlib = pre.dataset.matplotlib === "true";
    const needsPandas = pre.dataset.pandas === "true";
    const needsScipy = pre.dataset.scipy === "true";
    const needsSklearn = pre.dataset.sklearn === "true";
    const needsStatsmodels = pre.dataset.statsmodels === "true";
    /* `data-pkgs="pkg1,pkg2"` per casi non coperti dai flag rapidi sopra */
    const extraPkgs = (pre.dataset.pkgs || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const editor = el("textarea", {
      class: "code-editor",
      spellcheck: "false",
      "aria-label": "Editor di codice Python",
      rows: Math.max(3, Math.min(20, initialCode.split("\n").length + 1)),
    });
    editor.value = initialCode;

    const output = el("div", { class: "playground-output" });
    output.style.display = "none";

    const runBtn = el("button", { class: "btn primary", type: "button" }, "▶ Run");
    const resetBtn = el("button", { class: "btn ghost", type: "button" }, "Reset");
    const clearBtn = el("button", { class: "btn ghost", type: "button" }, "Pulisci output");

    const header = el("div", { class: "playground-header" },
      el("div", { class: "left" },
        el("span", { class: "dots" },
          el("span"), el("span"), el("span")
        ),
        el("span", {}, title)
      ),
      el("div", { class: "actions" }, runBtn, resetBtn, clearBtn)
    );

    const wrap = el("div", { class: "playground" }, header, editor, output);

    pre.parentNode.replaceChild(wrap, pre);

    /* --- editor: tab indenta invece di cambiare focus --- */
    editor.addEventListener("keydown", (ev) => {
      if (ev.key === "Tab") {
        ev.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const indent = "    ";
        editor.value = editor.value.slice(0, start) + indent + editor.value.slice(end);
        editor.selectionStart = editor.selectionEnd = start + indent.length;
      }
    });

    async function run() {
      runBtn.disabled = true;
      runBtn.textContent = "⏳ Eseguo…";
      output.style.display = "block";
      output.innerHTML = "";
      output.appendChild(el("span", { class: "output-label" }, "Output"));
      try {
        const pyodide = await loadPyodide();
        if (needsMatplotlib) await ensureMatplotlib(pyodide);
        if (needsPandas) {
          setStatus("Caricamento pandas…");
          await pyodide.loadPackage(["pandas"]);
          setStatus("Python pronto", "ready");
        }
        const extraToLoad = [];
        if (needsScipy) extraToLoad.push("scipy");
        if (needsSklearn) extraToLoad.push("scikit-learn");
        if (needsStatsmodels) extraToLoad.push("statsmodels");
        for (const p of extraPkgs) extraToLoad.push(p);
        if (extraToLoad.length > 0) {
          setStatus(`Caricamento ${extraToLoad.join(", ")}…`);
          await pyodide.loadPackage(extraToLoad);
          setStatus("Python pronto", "ready");
        }

        // Cattura stdout/stderr
        await pyodide.runPythonAsync(`
import sys, io
_il_stdout = io.StringIO()
_il_stderr = io.StringIO()
sys.stdout = _il_stdout
sys.stderr = _il_stderr
${needsMatplotlib ? "_il_plot_outputs.clear()" : ""}
        `);

        let pyResult;
        try {
          pyResult = await pyodide.runPythonAsync(editor.value);
        } catch (errInner) {
          // L'errore Python è già loggato in stderr nella maggior parte dei casi,
          // ma qui catturiamo eventuali eccezioni "JS-side"
          await pyodide.runPythonAsync(`
import traceback
sys.stderr.write(traceback.format_exc())
          `);
        }

        const out = await pyodide.runPythonAsync("_il_stdout.getvalue()");
        const err = await pyodide.runPythonAsync("_il_stderr.getvalue()");

        // Ripristina stdout/stderr
        await pyodide.runPythonAsync(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
        `);

        if (out) {
          output.appendChild(el("div", { class: "ok" }, out));
        }
        if (err) {
          output.appendChild(el("div", { class: "err" }, err));
        }

        // Rappresentazione del valore di ritorno (analogo a Jupyter "Out[...]")
        if (pyResult !== undefined && pyResult !== null && !err) {
          let repr;
          try {
            repr = await pyodide.runPythonAsync("repr(_)");
          } catch (_) {
            repr = String(pyResult);
          }
          if (repr && repr !== "None") {
            output.appendChild(el("div", { class: "ok" }, repr));
          }
        }

        // Eventuali plot matplotlib catturati
        if (needsMatplotlib) {
          const plotsLen = await pyodide.runPythonAsync("len(_il_plot_outputs)");
          for (let i = 0; i < plotsLen; i++) {
            const b64 = await pyodide.runPythonAsync(`_il_plot_outputs[${i}]`);
            const img = el("img", { src: `data:image/png;base64,${b64}`, alt: "Grafico" });
            output.appendChild(img);
          }
        }

        if (!output.children.length || (output.children.length === 1 && output.firstChild.classList.contains("output-label"))) {
          output.appendChild(el("div", { class: "ok" }, "(eseguito senza output)"));
        }
      } catch (e) {
        output.appendChild(el("div", { class: "err" }, String(e && e.message || e)));
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "▶ Run";
      }
    }

    runBtn.addEventListener("click", run);
    resetBtn.addEventListener("click", () => {
      editor.value = initialCode;
      output.style.display = "none";
      output.innerHTML = "";
    });
    clearBtn.addEventListener("click", () => {
      output.style.display = "none";
      output.innerHTML = "";
    });

    if (autoRun) {
      // Differito: l'utente potrebbe non voler scaricare Pyodide automaticamente
      setTimeout(run, 800);
    }
  }

  /* ---------------- Quiz ---------------- */

  /* Markup atteso:
     <div class="quiz" data-correct="2">
       <h4>Domanda</h4>
       <p>Testo della domanda…</p>
       <ul class="quiz-options">
         <li>Opzione 1</li>
         <li>Opzione 2</li>
         <li data-correct>Opzione 3 (corretta)</li>
       </ul>
       <div class="quiz-explain">Spiegazione…</div>
     </div>
  */
  function buildQuiz(quizEl) {
    if (!quizEl.classList.contains("quiz") || quizEl.dataset.built) return;
    quizEl.dataset.built = "true";

    const tag = el("span", { class: "quiz-tag" }, "Quiz");
    quizEl.insertBefore(tag, quizEl.firstChild);

    const optionsList = quizEl.querySelector(".quiz-options");
    if (!optionsList) return;

    const explainSrc = quizEl.querySelector(".quiz-explain");
    const explanation = explainSrc ? explainSrc.innerHTML : "";
    if (explainSrc) explainSrc.remove();

    const options = Array.from(optionsList.children);
    const optionsContainer = el("div", { class: "options" });
    const inputName = "quiz-" + Math.random().toString(36).slice(2, 8);

    options.forEach((li, idx) => {
      const isCorrect = li.hasAttribute("data-correct");
      const label = el("label", { class: "option", "data-idx": idx, "data-correct": isCorrect ? "true" : "false" },
        el("input", { type: "radio", name: inputName, value: idx }),
        el("span", { html: li.innerHTML })
      );
      optionsContainer.appendChild(label);
    });

    const submitBtn = el("button", { class: "btn primary", type: "button" }, "Verifica");
    const retryBtn = el("button", { class: "btn ghost", type: "button", style: { display: "none" } }, "Riprova");
    const feedback = el("div", { class: "feedback" });

    optionsList.replaceWith(optionsContainer);
    quizEl.appendChild(el("div", { style: { marginTop: "10px", display: "flex", gap: "8px" } }, submitBtn, retryBtn));
    quizEl.appendChild(feedback);

    function lockOptions(lock) {
      $$(".option", quizEl).forEach((opt) => {
        opt.classList.toggle("disabled", lock);
        opt.querySelector("input").disabled = lock;
      });
    }

    submitBtn.addEventListener("click", () => {
      const checked = quizEl.querySelector(`input[name="${inputName}"]:checked`);
      if (!checked) {
        feedback.className = "feedback show bad";
        feedback.textContent = "Seleziona prima un'opzione 🙂";
        return;
      }
      const chosen = checked.closest(".option");
      const isCorrect = chosen.dataset.correct === "true";
      $$(".option", quizEl).forEach((opt) => {
        if (opt.dataset.correct === "true") opt.classList.add("correct");
      });
      if (!isCorrect) chosen.classList.add("wrong");
      feedback.className = "feedback show " + (isCorrect ? "ok" : "bad");
      feedback.innerHTML = (isCorrect
        ? "✓ <strong>Corretto!</strong> "
        : "✗ <strong>Non proprio.</strong> ") + (explanation || "");
      lockOptions(true);
      submitBtn.style.display = "none";
      retryBtn.style.display = "inline-flex";
      progress.tick(quizEl);
    });

    retryBtn.addEventListener("click", () => {
      $$(".option", quizEl).forEach((opt) => {
        opt.classList.remove("correct", "wrong");
        opt.querySelector("input").checked = false;
      });
      feedback.className = "feedback";
      feedback.innerHTML = "";
      lockOptions(false);
      submitBtn.style.display = "inline-flex";
      retryBtn.style.display = "none";
    });
  }

  /* ---------------- Exercise (mostra/nascondi soluzione) ---------------- */

  function buildExercise(exEl) {
    if (!exEl.classList.contains("exercise") || exEl.dataset.built) return;
    exEl.dataset.built = "true";
    exEl.insertBefore(el("span", { class: "exercise-tag" }, "Esercizio"), exEl.firstChild);

    const solution = exEl.querySelector(".solution");
    if (solution) {
      const btn = el("button", { class: "btn ghost", type: "button" }, "Mostra soluzione");
      btn.addEventListener("click", () => {
        const open = solution.classList.toggle("show");
        btn.textContent = open ? "Nascondi soluzione" : "Mostra soluzione";
      });
      solution.parentNode.insertBefore(btn, solution);
    }
  }

  /* ---------------- Theme toggle ---------------- */

  function setupTheme() {
    const saved = localStorage.getItem("il-theme");
    if (saved === "light") document.documentElement.dataset.theme = "light";

    const toggle = $(".theme-toggle button");
    if (!toggle) return;
    function update() {
      const dark = document.documentElement.dataset.theme !== "light";
      toggle.textContent = dark ? "☀ Tema chiaro" : "🌙 Tema scuro";
    }
    toggle.addEventListener("click", () => {
      const dark = document.documentElement.dataset.theme !== "light";
      if (dark) document.documentElement.dataset.theme = "light";
      else document.documentElement.dataset.theme = "";
      localStorage.setItem("il-theme", dark ? "light" : "dark");
      update();
    });
    update();
  }

  /* ---------------- TOC scrollspy + progress ---------------- */

  const progress = {
    quizzesTotal: 0,
    quizzesDone: 0,
    bar: null,
    init() {
      this.bar = $(".progress-bar");
      this.quizzesTotal = $$(".quiz").length;
      this.update();
    },
    tick() {
      this.quizzesDone += 1;
      this.update();
    },
    update() {
      if (!this.bar) return;
      const pct = this.quizzesTotal === 0 ? 0 : Math.min(100, (this.quizzesDone / this.quizzesTotal) * 100);
      this.bar.style.width = pct + "%";
    },
  };

  function setupScrollSpy() {
    const links = $$(".toc a[href^='#']");
    if (links.length === 0) return;
    const targets = links
      .map((a) => ({ id: a.getAttribute("href").slice(1), link: a }))
      .map((o) => ({ ...o, el: document.getElementById(o.id) }))
      .filter((o) => o.el);

    function onScroll() {
      const top = window.scrollY + 80;
      let active = targets[0];
      for (const t of targets) {
        if (t.el.offsetTop <= top) active = t;
      }
      links.forEach((a) => a.classList.remove("is-active"));
      if (active) active.link.classList.add("is-active");
    }
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Init ---------------- */

  function init() {
    $$('pre[data-runnable]').forEach(buildPlayground);
    $$('.quiz').forEach(buildQuiz);
    $$('.exercise').forEach(buildExercise);
    setupTheme();
    setupScrollSpy();
    progress.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

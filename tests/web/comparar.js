/*
 * Prueba diferencial: ejecuta la versión web (docs/metodos.js y
 * docs/procedimiento.js) sobre los mismos casos que la versión Python y compara
 * cada número del resultado y del historial de iteraciones.
 *
 * Uso (desde la raíz del proyecto):
 *     python tests/web/generar_referencia.py
 *     node tests/web/comparar.js            (añade -v para ver más ejemplos)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const math = require("mathjs");
const katex = require("katex");

const RAIZ = path.join(__dirname, "..", "..");
globalThis.math = math;
for (const [archivo, nombre] of [["metodos.js", "Metodos"], ["procedimiento.js", "Procedimiento"]]) {
  const fuente = fs.readFileSync(path.join(RAIZ, "docs", archivo), "utf8");
  vm.runInThisContext(`${fuente}\n;globalThis.${nombre} = ${nombre};`, { filename: archivo });
}
const { Metodos, Procedimiento } = globalThis;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "referencia.json"), "utf8"));
const VERBOSO = process.argv.includes("-v");

const RTOL = 1e-9;
const ATOL = 1e-9;

// ---------------------------------------------------------------------------
// Decodificación y comparación
// ---------------------------------------------------------------------------

function dec(v) {
  if (v === "nan") return NaN;
  if (v === "inf") return Infinity;
  if (v === "-inf") return -Infinity;
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === "object") {
    const claves = Object.keys(v);
    if (claves.length === 2 && "re" in v && "im" in v) return math.complex(dec(v.re), dec(v.im));
    return Object.fromEntries(claves.map((k) => [k, dec(v[k])]));
  }
  return v;
}

const esNum = (v) => typeof v === "number" || Metodos.esComplejo(v);
const partes = (v) => (Metodos.esComplejo(v) ? [v.re, v.im] : [v, 0]);
const finito = (v) => partes(v).every(Number.isFinite);

function tieneNoFinito(v) {
  if (esNum(v)) return !finito(v);
  if (Array.isArray(v)) return v.some(tieneNoFinito);
  if (v && typeof v === "object") return Object.values(v).some(tieneNoFinito);
  return false;
}

class Seccion {
  constructor(nombre) {
    this.nombre = nombre;
    this.casos = 0;
    this.iguales = 0;
    this.numeros = 0;
    this.identicos = 0;
    this.maxAbs = 0;
    this.maxRel = 0;
    this.categorias = new Map(); // nombre -> { esFallo, ejemplos[], n }
  }

  /** Compara dos números (reales o complejos). Devuelve true si coinciden. */
  num(py, js) {
    this.numeros++;
    const [a1, a2] = partes(py);
    const [b1, b2] = partes(js);
    if (Object.is(a1, b1) && Object.is(a2, b2)) { this.identicos++; return true; }
    if ([a1, a2].some(Number.isNaN) || [b1, b2].some(Number.isNaN)) {
      return [a1, a2].some(Number.isNaN) && [b1, b2].some(Number.isNaN);
    }
    if (![a1, a2, b1, b2].every(Number.isFinite)) return a1 === b1 && a2 === b2;
    const dif = Math.hypot(a1 - b1, a2 - b2);
    const escala = Math.max(Math.hypot(a1, a2), Math.hypot(b1, b2));
    if (dif === 0) { this.identicos++; return true; }
    this.maxAbs = Math.max(this.maxAbs, dif);
    if (escala > 0) this.maxRel = Math.max(this.maxRel, dif / escala);
    return dif <= ATOL + RTOL * escala;
  }

  /** Compara estructuras; devuelve la ruta del primer desacuerdo o null. */
  cmp(py, js, ruta = "") {
    if (esNum(py) && esNum(js)) return this.num(py, js) ? null : `${ruta}: Python=${texto(py)} web=${texto(js)}`;
    if (Array.isArray(py) && Array.isArray(js)) {
      if (py.length !== js.length) return `${ruta}: longitud Python=${py.length} web=${js.length}`;
      for (let i = 0; i < py.length; i++) {
        const d = this.cmp(py[i], js[i], `${ruta}[${i}]`);
        if (d) return d;
      }
      return null;
    }
    return py === js ? null : `${ruta}: Python=${texto(py)} web=${texto(js)}`;
  }

  /** Compara los campos indicados: { campoPython: campoWeb }. */
  campos(py, js, mapa, ruta) {
    for (const [cp, cj] of Object.entries(mapa)) {
      const d = this.cmp(py[cp], js[cj], `${ruta}.${cp}`);
      if (d) return d;
    }
    return null;
  }

  ok() { this.casos++; this.iguales++; }

  nota(categoria, ejemplo, esFallo) {
    this.casos++;
    if (!this.categorias.has(categoria)) this.categorias.set(categoria, { esFallo, ejemplos: [], n: 0 });
    const c = this.categorias.get(categoria);
    c.n++;
    if (c.ejemplos.length < (VERBOSO ? 25 : 4)) c.ejemplos.push(ejemplo);
  }

  fallo(categoria, ejemplo) { this.nota(categoria, ejemplo, true); }
  esperado(categoria, ejemplo) { this.nota(categoria, ejemplo, false); }

  get fallos() {
    let n = 0;
    for (const c of this.categorias.values()) if (c.esFallo) n += c.n;
    return n;
  }

  imprimir() {
    console.log(`\n=== ${this.nombre} ===`);
    console.log(`  casos: ${this.casos}   idénticos a Python: ${this.iguales}   FALLOS: ${this.fallos}`);
    if (this.numeros) {
      console.log(`  números comparados: ${this.numeros}   bit a bit iguales: ${(100 * this.identicos / this.numeros).toFixed(2)} %`
        + `   mayor diferencia: abs ${this.maxAbs.toExponential(2)}, rel ${this.maxRel.toExponential(2)}`);
    }
    for (const [nombre, c] of this.categorias) {
      console.log(`  ${c.esFallo ? "✗ FALLO" : "· diferencia esperada"} — ${nombre}: ${c.n}`);
      for (const e of c.ejemplos) console.log(`      ${e}`);
    }
  }
}

function texto(v) {
  if (Metodos.esComplejo(v)) return `${v.re}${v.im >= 0 ? "+" : ""}${v.im}i`;
  return typeof v === "string" ? JSON.stringify(v) : String(v);
}

function intentar(fn) {
  try {
    return { ok: fn() };
  } catch (exc) {
    return { error: exc.message };
  }
}

// ---------------------------------------------------------------------------
// Comprobación del procedimiento en LaTeX
// ---------------------------------------------------------------------------

const procedimiento = new Seccion("Procedimiento paso a paso (LaTeX)");

function revisarLatex(bloques, descripcion) {
  for (const b of bloques) {
    const fuentes = b.tipo === "m"
      ? [`\\begin{aligned}${b.lineas.join(" \\\\ ")}\\end{aligned}`]
      : b.texto.split("$").filter((_, i) => i % 2);
    for (const f of fuentes) {
      if (/undefined|NaN|\[object|null/.test(f)) return `${descripcion}: valor inválido en «${f.slice(0, 120)}»`;
      try {
        katex.renderToString(f, { displayMode: b.tipo === "m", throwOnError: true, strict: false });
      } catch (exc) {
        return `${descripcion}: KaTeX no pudo dibujar «${f.slice(0, 120)}» (${exc.message.slice(0, 80)})`;
      }
    }
    if (b.tipo !== "m" && b.texto.split("$").length % 2 === 0) return `${descripcion}: $ sin cerrar en «${b.texto}»`;
  }
  const latex = Procedimiento.aLatex("Prueba", bloques);
  if ((latex.match(/\\begin\{align\*\}/g) || []).length !== (latex.match(/\\end\{align\*\}/g) || []).length) {
    return `${descripcion}: align* sin cerrar`;
  }
  return null;
}

/** Bloque de ecuaciones que sigue al subtítulo dado (p. ej. "Iteración 3"). */
function ecuacionesDe(bloques, subtitulo, desde = 0) {
  const i = bloques.findIndex((b, k) => k >= desde && b.tipo === "sub" && b.texto === subtitulo);
  if (i < 0) return null;
  const lineas = [];
  for (let k = i + 1; k < bloques.length && bloques[k].tipo !== "sub" && bloques[k].tipo !== "h"; k++) {
    if (bloques[k].tipo === "m") lineas.push(...bloques[k].lineas);
  }
  return lineas;
}

/** ¿El final de la ecuación muestra los mismos números, salvo una unidad en el último decimal? */
function casiIgual(linea, final) {
  const numeros = (t) => t.match(/-?\d+(?:\.\d+)?/g) || [];
  const esperados = numeros(final);
  const vistos = numeros(linea.slice(linea.lastIndexOf("=")));
  if (!esperados.length || esperados.length !== vistos.length) return false;
  return esperados.every((e, i) => {
    const decimales = Math.max(4, (e.split(".")[1] || "").length, (vistos[i].split(".")[1] || "").length);
    // una unidad del último decimal + la misma tolerancia numérica del resto de la prueba
    return Math.abs(Number(e) - Number(vistos[i])) <= 1.01 * 10 ** -decimales + 2 * (ATOL + RTOL * Math.abs(Number(e)));
  });
}

function revisarProcedimiento(descripcion, bloques, esperados) {
  let ultimoDecimal = false;
  const error = revisarLatex(bloques, descripcion);
  if (error) return procedimiento.fallo("LaTeX inválido", error);
  for (const [subtitulo, finales, desde] of esperados) {
    const lineas = ecuacionesDe(bloques, subtitulo, desde || 0);
    if (!lineas) return procedimiento.fallo("falta una iteración", `${descripcion}: no aparece «${subtitulo}»`);
    for (const final of finales) {
      if (lineas.some((l) => l.endsWith(final))) continue;
      if (lineas.some((l) => casiIgual(l, final))) { ultimoDecimal = true; continue; }
      return procedimiento.fallo("número distinto al de Python",
        `${descripcion}, ${subtitulo}: ninguna ecuación termina en «${final}»`);
    }
  }
  if (ultimoDecimal) {
    procedimiento.esperado("el último decimal mostrado cambia en una unidad (los valores coinciden a 1e-9, el redondeo cae a otro lado)", descripcion);
  } else procedimiento.ok();
}

const N = Procedimiento.n;
const DETALLADAS = 15;

// ---------------------------------------------------------------------------
// Expresiones
// ---------------------------------------------------------------------------

/** Diferencias conocidas entre los dos intérpretes (no son errores de la web). */
function diferenciaConocida(expr) {
  if (/log10/.test(expr)) return "error de la versión Python: no puede evaluar log10 (lo convierte en log10*(x)); la web sí";
  if (/\d[eE][+-]?\d/.test(expr)) return "error de la versión Python: rompe la notación científica (1e3 -> 1*e3); la web la entiende";
  if (/\/\//.test(expr)) return "la división entera // de Python no existe en la web";
  if (/^\s*[a-z]+\d*\s*$/i.test(expr) && expr.trim() !== "x") return "Python acepta por accidente el nombre de una función suelta; la web lo rechaza";
  if (/!|[A-Za-z)]\s+\d/.test(expr)) return "la web acepta notaciones extra que Python rechaza (factorial, «x 2»)";
  return null;
}

function probarExpresiones() {
  const S = new Seccion("Intérprete de expresiones f(x)");
  for (const caso of REF.expresiones) {
    const desc = `«${caso.expr}»`;
    const conocida = diferenciaConocida(caso.expr);
    if (conocida) { S.esperado(conocida, desc); continue; }
    const creada = intentar(() => Metodos.crearFuncion(caso.expr));
    if (caso.error) {
      if (creada.error) S.ok();
      else S.fallo("Python la rechaza y la web la acepta", desc);
      continue;
    }
    if (creada.error) { S.fallo("Python la acepta y la web la rechaza", `${desc}: ${creada.error}`); continue; }
    let diferencia = null;
    caso.puntos.forEach((p, i) => {
      if (diferencia) return;
      const x = dec(p);
      const py = caso.valores[i];
      const js = intentar(() => creada.ok(x));
      if (py.error) {
        if (!js.error && finito(js.ok)) diferencia = `x=${texto(x)}: Python da ${py.error}, web da ${texto(js.ok)}`;
      } else if (js.error) {
        diferencia = `x=${texto(x)}: Python da ${texto(dec(py.ok))}, web da error (${js.error})`;
      } else {
        diferencia = S.cmp(dec(py.ok), js.ok, `x=${texto(x)}`);
      }
    });
    if (diferencia) S.fallo("valor distinto", `${desc}  ${diferencia}`);
    else S.ok();
  }
  return S;
}

// ---------------------------------------------------------------------------
// Sistemas lineales
// ---------------------------------------------------------------------------

function probarSistemas() {
  const S = new Seccion("Jacobi y Gauss-Seidel");
  REF.sistemas.forEach((caso, idx) => {
    const { A, b, x0, tol } = caso;
    if (Metodos.esDiagonalmenteDominante(A) !== caso.dominante) {
      S.fallo("dominancia diagonal distinta", `caso ${idx}`);
      return;
    }
    for (const [clave, nombre, fn] of [["jacobi", "Jacobi", Metodos.jacobi], ["gs", "Gauss-Seidel", Metodos.gaussSeidel]]) {
      const py = dec(caso[clave]);
      const js = fn(A, b, x0, tol, caso.max_iter);
      const desc = `caso ${idx} ${nombre} (n=${A.length}, tol=${tol}, max=${caso.max_iter})`;

      if (tieneNoFinito(py.historial)) {
        // Python sigue iterando con inf/nan hasta max_iter; la web se detiene y avisa.
        const corte = js.historial.length;
        const d = S.cmp(py.historial.slice(0, corte), js.historial, "historial");
        if (d || !js.divergio || js.convergio || py.convergio) S.fallo("divergencia mal detectada", `${desc}: ${d || "banderas"}`);
        else S.esperado("sistema que diverge: Python sigue con inf/nan, la web se detiene y avisa", desc);
        continue;
      }
      const d = S.campos(py, js, { x: "x", historial: "historial", iteraciones: "iteraciones", convergio: "convergio" }, desc);
      if (d) { S.fallo("resultado distinto", d); continue; }
      S.ok();

      const total = py.historial.length - 1;
      const esperados = [];
      for (let k = 1; k <= Math.min(total, DETALLADAS); k++) {
        const difs = py.historial[k].map((v, i) => Math.abs(v - py.historial[k - 1][i]));
        esperados.push([`Iteración ${k}`, [...py.historial[k].map((v) => `= ${N(v)}`), `= ${N(Math.max(...difs))}`]]);
      }
      revisarProcedimiento(desc, Procedimiento.sistema(nombre, A, b, js, tol), esperados);
    }
  });
  return S;
}

// ---------------------------------------------------------------------------
// Raíces: lógica común para comparar "resultado u error"
// ---------------------------------------------------------------------------

function compararResultado(S, desc, pyRes, jsRes, comparar) {
  if (pyRes.error && jsRes.error) { S.ok(); return false; }
  if (pyRes.error) {
    S.fallo("Python da error y la web da resultado", `${desc}: Python ${pyRes.error} (${pyRes.mensaje})`);
    return false;
  }
  const py = dec(pyRes.ok);
  if (jsRes.error) {
    if (tieneNoFinito(py) || (/divergió/.test(jsRes.error) && py.convergio === false && math.abs(py.raiz) > 1e50)) {
      S.esperado("divergencia: Python devuelve inf/nan o un valor astronómico (> 1e50) sin converger; la web se detiene y muestra un mensaje", `${desc}: ${jsRes.error}`);
    } else {
      S.fallo("Python da resultado y la web da error", `${desc}: ${jsRes.error}`);
    }
    return false;
  }
  const d = comparar(py, jsRes.ok);
  if (d) { S.fallo("resultado distinto", d); return false; }
  S.ok();
  return true;
}

/**
 * Segunda comprobación para trayectorias que no coinciden: se le da a la web,
 * paso por paso, exactamente las mismas entradas que tuvo Python (x, f(x),
 * f'(x)) y se exige que cada paso produzca lo mismo. Si pasa, la lógica es
 * idéntica y la diferencia de trayectoria se debe solo al redondeo de las
 * funciones matemáticas (cos, exp, ...) amplificado por un problema inestable.
 */
function pasosNewton(S, py, tol) {
  for (const h of py.historial) {
    const r = intentar(() => Metodos.newtonRaphson(() => h.fx, h.x, () => h.dfx, tol, 1));
    if (r.error) return `paso ${h.i}: ${r.error}`;
    const d = S.campos(h, r.ok.historial[0], { x_nuevo: "xNuevo", error: "error" }, `paso ${h.i}`);
    if (d) return d;
  }
  return null;
}

function pasosMuller(S, py, tol, campos) {
  for (const h of py.historial) {
    const tabla = new Map([[h.x0, h.fx0], [h.x1, h.fx1], [h.x2, h.fx2]]);
    const r = intentar(() => Metodos.muller((x) => (tabla.has(x) ? tabla.get(x) : 0), h.x0, h.x1, h.x2, tol, 1));
    if (r.error) return `paso ${h.i}: ${r.error}`;
    const d = S.campos({ ...h, i: 1 }, r.ok.historial[0], campos, `paso ${h.i}`);
    if (d) return d;
  }
  return null;
}

const SENSIBLE = "problema inestable: cada paso coincide con Python, pero el redondeo de cos/exp/... se amplifica y la trayectoria completa cambia";

function probarNewton() {
  const S = new Seccion("Newton-Raphson");
  REF.newton.forEach((caso) => {
    const desc = `«${caso.expr}» x0=${caso.x0} tol=${caso.tol} max=${caso.max_iter} derivada ${caso.modo}`;
    let f, df;
    const js = intentar(() => {
      f = Metodos.crearFuncion(caso.expr);
      df = caso.modo === "simbolica" ? Metodos.derivadaSimbolica(f)
        : caso.modo === "explicita" ? Metodos.crearFuncion(caso.df_expr) : null;
      return Metodos.newtonRaphson(f, caso.x0, df, caso.tol, caso.max_iter);
    });
    const conocida = diferenciaConocida(caso.expr);
    if (conocida) { S.esperado(conocida, desc); return; }
    if (caso.modo === "simbolica" && !js.error && caso.resultado.ok && (caso.df_python === null) !== (df === null)) {
      // Python no logra derivar "13x" con sympy y usa derivada numérica; la web deriva exacto.
      const py = dec(caso.resultado.ok);
      const cerca = py.convergio === js.ok.convergio
        && (!py.convergio || math.abs(math.subtract(py.raiz, js.ok.raiz)) <= 1e-6 * Math.max(1, math.abs(py.raiz)));
      if (cerca) {
        S.esperado("derivada automática: Python no deriva expresiones con producto implícito (13x) y usa la numérica; la web deriva exacto. Misma raíz",
          `«${caso.expr}» x0=${caso.x0}`);
      } else {
        S.fallo("derivada simbólica frente a numérica: raíz distinta", `${desc}: Python ${texto(py.raiz)} web ${texto(js.ok.raiz)}`);
      }
      return;
    }
    if (caso.resultado.ok && js.ok) {
      const py = dec(caso.resultado.ok);
      const prueba = new Seccion("tmp");
      const d = prueba.campos(py, js.ok, { raiz: "raiz", iteraciones: "iteraciones" }, "")
        || prueba.cmp(py.historial.map((h) => [h.x, h.fx, h.dfx, h.x_nuevo, h.error]),
          js.ok.historial.map((h) => [h.x, h.fx, h.dfx, h.xNuevo, h.error]), "");
      if (d) {
        const paso = pasosNewton(S, py, caso.tol);
        if (paso) S.fallo("un paso da distinto con las mismas entradas", `${desc}: ${paso}`);
        else S.esperado(SENSIBLE, `${desc}: Python ${py.iteraciones} it. raíz ${texto(py.raiz)} | web ${js.ok.iteraciones} it. raíz ${texto(js.ok.raiz)}`);
        return;
      }
    }
    const igual = compararResultado(S, desc, caso.resultado, js, (py, r) =>
      S.campos(py, r, { raiz: "raiz", iteraciones: "iteraciones", convergio: "convergio", f_raiz: "fRaiz" }, desc)
      || (py.historial.length !== r.historial.length ? `${desc}: historial de distinta longitud` : null)
      || py.historial.map((h, i) => S.campos(h, r.historial[i],
        { i: "i", x: "x", fx: "fx", dfx: "dfx", x_nuevo: "xNuevo", error: "error" }, `${desc} it.${i}`)).find(Boolean) || null);
    if (igual) {
      const py = dec(caso.resultado.ok);
      const esperados = py.historial.slice(0, DETALLADAS).map((h) =>
        [`Iteración ${h.i}`, [`= ${N(h.x_nuevo, 8)}`, `= ${N(h.error, 6)}\\,\\%`]]);
      revisarProcedimiento(desc, Procedimiento.newton(f.tex, df ? df.tex : null, js.ok, caso.tol), esperados);
    }
  });
  return S;
}

function probarMuller() {
  const S = new Seccion("Müller");
  const CAMPOS = { i: "i", x0: "x0", x1: "x1", x2: "x2", x3: "x3", error: "error", fx0: "fx0", fx1: "fx1", fx2: "fx2",
    h0: "h0", h1: "h1", d0: "d0", d1: "d1", a: "a", b: "b", c: "c", discriminante: "discriminante", denominador: "denominador" };
  REF.muller.forEach((caso) => {
    const desc = `«${caso.expr}» (${caso.x0}, ${caso.x1}, ${caso.x2}) tol=${caso.tol} max=${caso.max_iter}`;
    let f;
    const js = intentar(() => {
      f = Metodos.crearFuncion(caso.expr);
      return Metodos.muller(f, caso.x0, caso.x1, caso.x2, caso.tol, caso.max_iter);
    });
    if (caso.resultado.ok && js.ok) {
      const py = dec(caso.resultado.ok);
      const prueba = new Seccion("tmp");
      const d = prueba.campos(py, js.ok, { raiz: "raiz", iteraciones: "iteraciones", convergio: "convergio" }, "")
        || (py.historial.length !== js.ok.historial.length ? "longitud" : null)
        || py.historial.map((h, i) => prueba.campos(h, js.ok.historial[i], CAMPOS, "")).find(Boolean);
      if (d) {
        // Lo que se muestra al usuario (tabla y resultado) debe coincidir igualmente.
        const visible = S.campos(py, js.ok, { raiz: "raiz", iteraciones: "iteraciones", convergio: "convergio" }, desc)
          || (py.historial.length !== js.ok.historial.length ? `${desc}: historial de distinta longitud` : null)
          || py.historial.map((h, i) => S.campos(h, js.ok.historial[i], { x0: "x0", x1: "x1", x2: "x2", x3: "x3" }, `${desc} it.${i + 1}`)).find(Boolean);
        const paso = pasosMuller(S, py, caso.tol, CAMPOS);
        if (paso) S.fallo("un paso da distinto con las mismas entradas", `${desc}: ${paso}`);
        else if (visible) S.esperado(SENSIBLE, `${desc}: ${visible}`);
        else S.esperado("valores intermedios mal condicionados (diferencias divididas con h ≈ 0): raíz, iteraciones y x0..x3 coinciden, y cada paso coincide con las mismas entradas", desc);
        return;
      }
    }
    const igual = compararResultado(S, desc, caso.resultado, js, (py, r) =>
      S.campos(py, r, { raiz: "raiz", iteraciones: "iteraciones", convergio: "convergio", f_raiz: "fRaiz" }, desc)
      || (py.historial.length !== r.historial.length ? `${desc}: historial de distinta longitud` : null)
      || py.historial.map((h, i) => S.campos(h, r.historial[i], CAMPOS, `${desc} it.${i + 1}`)).find(Boolean) || null);
    if (igual) {
      const py = dec(caso.resultado.ok);
      const esperados = py.historial.slice(0, DETALLADAS).map((h) =>
        [`Iteración ${h.i}`, [`= ${N(h.x3)}`, `= ${N(h.error)}\\,\\%`]]);
      revisarProcedimiento(desc, Procedimiento.muller(f.tex, js.ok, caso.tol), esperados);
    }
  });
  return S;
}

function probarBairstow() {
  const S = new Seccion("Bairstow");
  const CAMPOS = { i: "i", r: "r", s: "s", delta_r: "deltaR", delta_s: "deltaS", r_nuevo: "rNuevo", s_nuevo: "sNuevo",
    error_r: "errorR", error_s: "errorS", b: "b", c: "c" };
  REF.bairstow.forEach((caso, idx) => {
    const desc = `caso ${idx} [${caso.coefs.join(", ")}] r=${caso.r} s=${caso.s} tol=${caso.tol} max=${caso.max_iter}`;
    const js = intentar(() => Metodos.bairstow(caso.coefs, caso.r, caso.s, caso.tol, caso.max_iter));
    const igual = compararResultado(S, desc, caso.resultado, js, (py, r) => {
      let d = S.campos(py, r, { raices: "raices", convergio: "convergio", polinomio: "polinomio" }, desc);
      if (d) return d;
      if (py.factores.length !== r.factores.length) return `${desc}: número de factores distinto`;
      for (let k = 0; k < py.factores.length; k++) {
        const fp = py.factores[k];
        const fj = r.factores[k];
        d = S.campos(fp, fj, { grado: "grado", r: "r", s: "s", iteraciones: "iteraciones", convergio: "convergio",
          raices: "raices", polinomio: "polinomio" }, `${desc} factor ${k + 1}`);
        if (d) return d;
        if (fp.historial.length !== fj.historial.length) return `${desc} factor ${k + 1}: historial de distinta longitud`;
        for (let i = 0; i < fp.historial.length; i++) {
          d = S.campos(fp.historial[i], fj.historial[i], CAMPOS, `${desc} factor ${k + 1} it.${i + 1}`);
          if (d) return d;
        }
      }
      return null;
    });
    if (igual) {
      const py = dec(caso.resultado.ok);
      const bloques = Procedimiento.bairstow(js.ok, caso.tol);
      const esperados = [];
      py.factores.forEach((factor, k) => {
        const desde = bloques.findIndex((b) => b.tipo === "h" && b.texto.startsWith(`Factor ${k + 1}:`));
        for (const h of factor.historial.slice(0, DETALLADAS)) {
          esperados.push([`Iteración ${h.i}`, [`= ${N(h.delta_r)}`, `= ${N(h.delta_s)}`, `= ${N(h.r_nuevo)}`, `= ${N(h.s_nuevo)}`,
            `= ${N(h.error_r, 4)}\\,\\%`, `= ${N(h.error_s, 4)}\\,\\%`], desde]);
        }
        esperados.push([`Raíces del factor ${k + 1}`,
          [`x &= ${Metodos.fmt(factor.raices[0])}, \\qquad x = ${Metodos.fmt(factor.raices[1])}`], desde]);
      });
      revisarProcedimiento(desc, bloques, esperados);
    }
  });
  return S;
}

// ---------------------------------------------------------------------------
// Formato de números y polinomios
// ---------------------------------------------------------------------------

function probarFormato() {
  const S = new Seccion("Formato de números y polinomios");
  for (const caso of REF.formato) {
    const v = dec(caso.v);
    const js = Metodos.fmt(v, caso.d);
    if (js === caso.texto) S.ok();
    else if (Number(js.replace(/[^0-9.eE+-]/g, "")) === 0 && /^-0\.0+$/.test(caso.texto)) {
      S.esperado("cero negativo: Python escribe -0.000000 y la web 0.000000", `${texto(v)} con ${caso.d} decimales`);
    } else S.fallo("fmt() distinto de formatear_numero()", `${texto(v)} con ${caso.d} decimales: Python «${caso.texto}» web «${js}»`);
  }
  for (const caso of REF.limpio) {
    const v = dec(caso.v);
    const n = Procedimiento.n(v, caso.d);
    if (n === caso.n) S.ok();
    else if (caso.n === "-0" && n === "0") S.esperado("cero negativo: Python escribe -0 y la web 0", `${texto(v)} con ${caso.d} decimales`);
    else S.fallo("n() distinto de _n()", `${texto(v)} con ${caso.d} decimales: Python «${caso.n}» web «${n}»`);
  }
  for (const caso of REF.polinomios) {
    const js = Metodos.polinomioTex(caso.coefs).replace(/[{}]/g, "");
    if (js === caso.texto) S.ok();
    else S.fallo("polinomio escrito distinto", `[${caso.coefs.join(", ")}]: Python «${caso.texto}» web «${js}»`);
  }
  return S;
}

// ---------------------------------------------------------------------------

/**
 * Lo que la versión Python no puede evaluar (log10, notación científica) no
 * tiene referencia, así que se comprueba contra valores exactos conocidos.
 */
function probarPropias() {
  const S = new Seccion("Comprobaciones propias de la web (sin referencia en Python)");
  const cerca = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
  const casos = [
    ["log10(x) + 1 en x = 0.1", () => Metodos.crearFuncion("log10(x) + 1")(0.1), 0],
    ["log10(x) en x = 1000", () => Metodos.crearFuncion("log10(x)")(1000), 3],
    ["log10(10x) en x = 10", () => Metodos.crearFuncion("log10(10x)")(10), 2],
    ["1e-3 + x en x = 1", () => Metodos.crearFuncion("1e-3 + x")(1), 1.001],
    ["2.5e-1*x en x = 2", () => Metodos.crearFuncion("2.5e-1*x")(2), 0.5],
    ["1e3x en x = 2", () => Metodos.crearFuncion("1e3x")(2), 2000],
    ["2e^x en x = 0 (aquí e es la constante)", () => Metodos.crearFuncion("2e^x")(0), 2],
    ["Newton log10(x) + 1 desde 0.05", () => {
      const f = Metodos.crearFuncion("log10(x) + 1");
      return Metodos.newtonRaphson(f, 0.05, Metodos.derivadaSimbolica(f), 1e-10, 100).raiz;
    }, 0.1],
    ["Newton log10(x) + 1 desde 0.05, derivada numérica", () =>
      Metodos.newtonRaphson(Metodos.crearFuncion("log10(x) + 1"), 0.05, null, 1e-10, 100).raiz, 0.1],
    ["derivada simbólica de log10(x) en x = 2", () =>
      Metodos.derivadaSimbolica(Metodos.crearFuncion("log10(x)"))(2), 1 / (2 * Math.LN10)],
    ["derivada simbólica de x^3 - 13x - 12 en x = 2", () =>
      Metodos.derivadaSimbolica(Metodos.crearFuncion("x^3 - 13x - 12"))(2), -1],
  ];
  for (const [nombre, fn, esperado] of casos) {
    const r = intentar(fn);
    if (r.error) S.fallo("error inesperado", `${nombre}: ${r.error}`);
    else if (!cerca(r.ok, esperado)) S.fallo("valor incorrecto", `${nombre}: se obtuvo ${texto(r.ok)}, se esperaba ${esperado}`);
    else S.ok();
  }
  for (const expr of ["x = 3", "x; 2", "f(x) = x^2", "y + 1", "foo(x)", "", "x +", "(x+1"]) {
    if (intentar(() => Metodos.crearFuncion(expr)).error) S.ok();
    else S.fallo("debería rechazarse", `«${expr}»`);
  }
  return S;
}

const secciones = [probarExpresiones(), probarSistemas(), probarNewton(), probarMuller(), probarBairstow(), probarFormato(),
  procedimiento, probarPropias()];
let fallos = 0;
for (const s of secciones) {
  s.imprimir();
  fallos += s.fallos;
}
console.log(`\nTOTAL: ${secciones.reduce((t, s) => t + s.casos, 0)} comprobaciones, ${fallos} fallos.`);
process.exit(fallos ? 1 : 0);

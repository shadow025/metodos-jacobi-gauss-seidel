/*
 * Interfaz web: pestañas, lectura y validación de formularios, y dibujo de
 * resultados (resumen, tabla de iteraciones y procedimiento en LaTeX con KaTeX).
 */
/* global katex, math, Metodos, Procedimiento */
"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  if (!window.katex || !window.math) {
    $("aviso-carga").hidden = false;
    return;
  }

  const { fmt } = Metodos;
  const MAX_ITERACIONES_PERMITIDAS = 10000;

  // -------------------------------------------------------------------------
  // Utilidades de dibujo
  // -------------------------------------------------------------------------

  const tex = (fuente, bloque = false) =>
    katex.renderToString(fuente, { displayMode: bloque, throwOnError: false, fleqn: true });

  const escapar = (texto) =>
    texto.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /** Texto con matemática en línea entre $...$ -> HTML. */
  const htmlConMate = (texto) =>
    texto.split("$").map((parte, i) => (i % 2 ? tex(parte) : escapar(parte))).join("");

  function el(etiqueta, atributos = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) {
      if (clave === "html") nodo.innerHTML = valor;
      else if (clave === "texto") nodo.textContent = valor;
      else nodo.setAttribute(clave, valor);
    }
    nodo.append(...hijos.filter((h) => h !== null && h !== undefined));
    return nodo;
  }

  const alineado = (lineas) => tex(`\\begin{aligned}${lineas.join(" \\\\ ")}\\end{aligned}`, true);

  /** Número en LaTeX con decimales fijos (para resúmenes). */
  const numTex = (v, d = 6) => fmt(v, d).replace("∞", "\\infty").replace("indefinido", "\\text{indefinido}");

  function bloque(titulo, nivel, ...contenido) {
    return el("section", { class: "bloque" }, el(`h${nivel}`, { texto: titulo }), ...contenido);
  }

  function resumen(ok, etiqueta, ...contenido) {
    return el("div", { class: `tarjeta resumen ${ok ? "ok" : "mal"}` },
      el("p", { class: `insignia ${ok ? "ok" : "mal"}`, texto: `${ok ? "✓" : "⚠"} ${etiqueta}` }),
      ...contenido);
  }

  function tabla(titulo, cabeceras, filas) {
    const thead = el("thead", {}, el("tr", {}, ...cabeceras.map((c) => el("th", { scope: "col", html: tex(c) }))));
    const tbody = el("tbody", {}, ...filas.map((fila) =>
      el("tr", {}, ...fila.map((celda, j) =>
        j === 0 ? el("th", { scope: "row", texto: String(celda) }) : el("td", { texto: String(celda) })))));
    return el("div", { class: "tabla-envoltura", tabindex: "0", role: "region", "aria-label": `${titulo} (desplazable)` },
      el("table", {}, el("caption", { texto: titulo }), thead, tbody));
  }

  function dibujarBloques(bloques, nivel) {
    return bloques.map((b) => {
      if (b.tipo === "h") return el(`h${nivel}`, { class: "paso", html: htmlConMate(b.texto) });
      if (b.tipo === "sub") return el(`h${nivel + 1}`, { class: "iteracion", html: htmlConMate(b.texto) });
      if (b.tipo === "p") return el("p", { html: htmlConMate(b.texto) });
      return el("div", { class: "mate", html: alineado(b.lineas) });
    });
  }

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (exc) {
      const area = el("textarea", { class: "solo-lectores", "aria-hidden": "true" });
      area.value = texto;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  function seccionProcedimiento(titulo, bloques, nivel, estado) {
    const botonCopiar = el("button", { type: "button", class: "secundario pequeno", texto: "Copiar LaTeX" });
    botonCopiar.addEventListener("click", async () => {
      await copiarTexto(Procedimiento.aLatex(titulo, bloques));
      botonCopiar.textContent = "¡Copiado!";
      estado.textContent = "Procedimiento copiado al portapapeles en formato LaTeX.";
      setTimeout(() => { botonCopiar.textContent = "Copiar LaTeX"; }, 2000);
    });
    const botonImprimir = el("button", { type: "button", class: "secundario pequeno", texto: "Imprimir / PDF" });
    botonImprimir.addEventListener("click", () => window.print());

    return el("section", { class: "bloque" },
      el("div", { class: "procedimiento-cabecera" },
        el(`h${nivel}`, { texto: "Procedimiento paso a paso" }),
        el("div", { class: "procedimiento-acciones" }, botonCopiar, botonImprimir)),
      el("div", { class: "tarjeta procedimiento" }, ...dibujarBloques(bloques, nivel + 1)));
  }

  // -------------------------------------------------------------------------
  // Lectura y validación de campos
  // -------------------------------------------------------------------------

  class ErrorDeCampo extends Error {
    constructor(mensaje, campo) {
      super(mensaje);
      this.campo = campo;
    }
  }

  function leerNumero(id, nombre) {
    const texto = $(id).value.trim().replace(",", ".");
    const valor = Number(texto);
    if (!texto || !Number.isFinite(valor)) {
      throw new ErrorDeCampo(`«${nombre}» debe ser un número${texto ? ` (se recibió «${texto}»)` : ""}.`, id);
    }
    return valor;
  }

  function leerTolerancia(id) {
    const valor = leerNumero(id, "Tolerancia");
    if (valor <= 0) throw new ErrorDeCampo("La tolerancia debe ser mayor que 0.", id);
    return valor;
  }

  function leerIteraciones(id) {
    const texto = $(id).value.trim();
    if (!/^\d+$/.test(texto) || Number(texto) < 1) {
      throw new ErrorDeCampo("«Máx. iteraciones» debe ser un entero mayor o igual a 1.", id);
    }
    if (Number(texto) > MAX_ITERACIONES_PERMITIDAS) {
      throw new ErrorDeCampo(`«Máx. iteraciones» no puede pasar de ${MAX_ITERACIONES_PERMITIDAS}.`, id);
    }
    return Number(texto);
  }

  function leerLista(texto, nombre, id) {
    const partes = texto.replace(/[,;]/g, " ").split(/\s+/).filter(Boolean);
    if (!partes.length) throw new ErrorDeCampo(`«${nombre}» está vacío.`, id);
    const valores = partes.map(Number);
    if (valores.some((v) => !Number.isFinite(v))) {
      throw new ErrorDeCampo(`«${nombre}» debe contener solo números separados por espacio.`, id);
    }
    return valores;
  }

  function leerFuncion(id, nombre) {
    try {
      return Metodos.crearFuncion($(id).value);
    } catch (exc) {
      throw new ErrorDeCampo(`${nombre}: ${exc.message}`, id);
    }
  }

  function limpiarError(prefijo) {
    const caja = $(`${prefijo}-error`);
    caja.hidden = true;
    caja.textContent = "";
    $(`${prefijo}-form`).querySelectorAll("[aria-invalid]").forEach((c) => c.removeAttribute("aria-invalid"));
  }

  function mostrarError(prefijo, exc) {
    const caja = $(`${prefijo}-error`);
    caja.textContent = exc.message;
    caja.hidden = false;
    if (exc.campo) {
      const campo = $(exc.campo);
      campo.setAttribute("aria-invalid", "true");
      campo.focus();
    }
  }

  /** Conecta el formulario: valida, resuelve y muestra errores junto al campo. */
  function conectar(prefijo, resolver, ejemplo, cargarEjemplo) {
    $(`${prefijo}-form`).addEventListener("submit", (evento) => {
      evento.preventDefault();
      limpiarError(prefijo);
      try {
        const { nodos, estado } = resolver();
        $(`${prefijo}-resultados`).replaceChildren(...nodos);
        $(`${prefijo}-estado`).textContent = estado;
      } catch (exc) {
        mostrarError(prefijo, exc);
      }
    });
    $(`${prefijo}-ejemplo`).addEventListener("click", () => {
      limpiarError(prefijo);
      cargarEjemplo(ejemplo);
      $(`${prefijo}-estado`).textContent = "Ejemplo cargado.";
    });
    cargarEjemplo(ejemplo);
  }

  function ponerValores(valores) {
    for (const [id, valor] of Object.entries(valores)) {
      $(id).value = valor;
      $(id).dispatchEvent(new Event("input"));
    }
  }

  // -------------------------------------------------------------------------
  // Jacobi / Gauss-Seidel
  // -------------------------------------------------------------------------

  function leerSistema() {
    const lineas = $("s-a").value.split("\n").filter((l) => l.trim());
    if (!lineas.length) throw new ErrorDeCampo("Ingresa la matriz A.", "s-a");
    const A = lineas.map((l, i) => leerLista(l, `Fila ${i + 1} de A`, "s-a"));
    const n = A.length;
    A.forEach((fila, i) => {
      if (fila.length !== n) {
        throw new ErrorDeCampo(`La fila ${i + 1} de A tiene ${fila.length} valores; se esperaban ${n} (matriz cuadrada).`, "s-a");
      }
    });
    A.forEach((fila, i) => {
      if (fila[i] === 0) {
        throw new ErrorDeCampo(`La fila ${i + 1} tiene un 0 en la diagonal: reordena las ecuaciones.`, "s-a");
      }
    });
    const b = leerLista($("s-b").value, "Vector b", "s-b");
    if (b.length !== n) throw new ErrorDeCampo(`El vector b tiene ${b.length} valores; se esperaban ${n}.`, "s-b");
    let x0 = null;
    if ($("s-x0").value.trim()) {
      x0 = leerLista($("s-x0").value, "Aproximación inicial", "s-x0");
      if (x0.length !== n) throw new ErrorDeCampo(`La aproximación inicial tiene ${x0.length} valores; se esperaban ${n}.`, "s-x0");
    }
    return { A, b, x0 };
  }

  function vistaPreviaSistema() {
    const caja = $("s-previa");
    try {
      const { A, b } = leerSistema();
      const filas = A.map((fila, i) => {
        let texto = "";
        fila.forEach((c, j) => {
          if (c === 0) return;
          const mag = Math.abs(c) === 1 ? "" : Procedimiento.n(Math.abs(c));
          const termino = `${mag}x_{${j + 1}}`;
          texto += texto ? ` ${c < 0 ? "-" : "+"} ${termino}` : (c < 0 ? "-" : "") + termino;
        });
        return `${texto || "0"} &= ${Procedimiento.n(b[i])}`;
      });
      caja.innerHTML = alineado(filas);
    } catch (exc) {
      caja.replaceChildren();
    }
  }

  function resolverSistemas() {
    const { A, b, x0 } = leerSistema();
    const tol = leerTolerancia("s-tol");
    const maxIter = leerIteraciones("s-iter");
    const metodo = document.querySelector('input[name="s-metodo"]:checked').value;
    const dominante = Metodos.esDiagonalmenteDominante(A);
    const estadoNodo = $("s-estado");

    const corridas = [];
    if (metodo !== "gs") corridas.push(["Jacobi", Metodos.jacobi(A, b, x0, tol, maxIter)]);
    if (metodo !== "jacobi") corridas.push(["Gauss-Seidel", Metodos.gaussSeidel(A, b, x0, tol, maxIter)]);

    const frases = [];
    const nodos = corridas.map(([nombre, r]) => {
      const n = r.x.length;
      const etiqueta = r.convergio ? `Convergió en ${r.iteraciones} iteraciones`
        : r.divergio ? `Divergió en la iteración ${r.iteraciones}`
          : `No convergió en ${r.iteraciones} iteraciones`;
      frases.push(`${nombre}: ${etiqueta.toLowerCase()}.`);

      const cabeceras = ["k", ...r.x.map((_, i) => `x_{${i + 1}}`), "\\text{error}"];
      const filas = r.historial.map((x, k) => {
        const error = k === 0 ? "—" : fmt(Math.max(...x.map((v, i) => Math.abs(v - r.historial[k - 1][i]))), 8);
        return [k, ...x.map((v) => fmt(v)), error];
      });

      return el("article", { class: "metodo" },
        el("h3", { texto: nombre }),
        bloque("Resultado", 4, resumen(r.convergio, etiqueta,
          el("div", { class: "valores" }, ...r.x.map((v, i) => el("span", { html: tex(`x_{${i + 1}} \\approx ${numTex(v)}`) }))),
          el("p", { texto: dominante
            ? "La matriz es diagonalmente dominante: la convergencia está garantizada."
            : "La matriz no es diagonalmente dominante: la convergencia no está garantizada." }))),
        bloque("Tabla de iteraciones", 4, tabla(`Iteraciones de ${nombre} (${n} incógnitas)`, cabeceras, filas)),
        seccionProcedimiento(`Método de ${nombre}`, Procedimiento.sistema(nombre, A, b, r, tol), 4, estadoNodo));
    });
    return { nodos, estado: frases.join(" ") };
  }

  // -------------------------------------------------------------------------
  // Newton-Raphson
  // -------------------------------------------------------------------------

  function derivadaNewton(f) {
    if ($("n-df").value.trim()) {
      return { df: leerFuncion("n-df", "f'(x)"), origen: "ingresada" };
    }
    const df = Metodos.derivadaSimbolica(f);
    return df ? { df, origen: "calculada automáticamente" } : { df: null, origen: "numérica, por diferencias centrales" };
  }

  function vistaPreviaNewton() {
    const caja = $("n-previa");
    try {
      const f = Metodos.crearFuncion($("n-f").value);
      const lineas = [`f(x) &= ${f.tex}`];
      let nota = "";
      try {
        const { df, origen } = derivadaNewton(f);
        if (df) lineas.push(`f'(x) &= ${df.tex}`);
        nota = `Derivada ${origen}.`;
      } catch (exc) {
        nota = "La derivada ingresada no es válida.";
      }
      caja.innerHTML = alineado(lineas);
      caja.append(el("p", { class: "nota", texto: nota }));
    } catch (exc) {
      caja.replaceChildren();
    }
  }

  function resolverNewton() {
    const f = leerFuncion("n-f", "f(x)");
    const { df, origen } = derivadaNewton(f);
    const x0 = leerNumero("n-x0", "Valor inicial");
    const tol = leerTolerancia("n-tol");
    const maxIter = leerIteraciones("n-iter");
    const r = Metodos.newtonRaphson(f, x0, df, tol, maxIter);

    const etiqueta = r.convergio ? `Convergió en ${r.iteraciones} iteraciones` : `No convergió en ${r.iteraciones} iteraciones`;
    const filas = r.historial.map((h) => [h.i, fmt(h.x, 8), fmt(h.fx, 8), fmt(h.dfx, 8), fmt(h.xNuevo, 8), fmt(h.error, 6)]);
    const nodos = [
      bloque("Resultado", 3, resumen(r.convergio, etiqueta,
        el("div", { class: "valores" },
          el("span", { html: tex(`x \\approx ${numTex(r.raiz, 8)}`) }),
          el("span", { html: tex(`f(x) = ${numTex(r.fRaiz, 10)}`) })),
        el("p", { html: `Derivada ${escapar(origen)}${df ? `: ${tex(`f'(x) = ${df.tex}`)}` : "."}` }))),
      bloque("Tabla de iteraciones", 3, tabla("Iteraciones de Newton-Raphson",
        ["i", "x_i", "f(x_i)", "f'(x_i)", "x_{i+1}", "\\varepsilon_a\\ (\\%)"], filas)),
      seccionProcedimiento("Método de Newton-Raphson",
        Procedimiento.newton(f.tex, df ? df.tex : null, r, tol), 3, $("n-estado")),
    ];
    return { nodos, estado: `${etiqueta}. Raíz aproximada: ${fmt(r.raiz, 8)}.` };
  }

  // -------------------------------------------------------------------------
  // Müller
  // -------------------------------------------------------------------------

  function vistaPreviaFuncion(idCampo, idCaja) {
    const caja = $(idCaja);
    try {
      caja.innerHTML = alineado([`f(x) &= ${Metodos.crearFuncion($(idCampo).value).tex}`]);
    } catch (exc) {
      caja.replaceChildren();
    }
  }

  function resolverMuller() {
    const f = leerFuncion("m-f", "f(x)");
    const x0 = leerNumero("m-x0", "x0");
    const x1 = leerNumero("m-x1", "x1");
    const x2 = leerNumero("m-x2", "x2");
    const tol = leerTolerancia("m-tol");
    const maxIter = leerIteraciones("m-iter");
    if (x0 === x1 || x1 === x2 || x0 === x2) {
      throw new ErrorDeCampo("Los tres puntos iniciales deben ser distintos entre sí.", "m-x0");
    }
    const r = Metodos.muller(f, x0, x1, x2, tol, maxIter);

    const compleja = Metodos.esComplejo(r.raiz);
    const etiqueta = r.convergio ? `Convergió en ${r.iteraciones} iteraciones` : `No convergió en ${r.iteraciones} iteraciones`;
    const filas = r.historial.map((h) => [h.i, fmt(h.x0), fmt(h.x1), fmt(h.x2), fmt(h.x3), fmt(h.error, 6)]);
    const nodos = [
      bloque("Resultado", 3, resumen(r.convergio, etiqueta,
        el("div", { class: "valores" },
          el("span", { html: tex(`x \\approx ${numTex(r.raiz, 8)}`) }),
          el("span", { html: tex(`f(x) = ${numTex(r.fRaiz, 10)}`) })),
        el("p", { html: compleja
          ? `La raíz es compleja; su conjugada ${tex(numTex(r.raiz.conjugate(), 8))} también es raíz.`
          : "La raíz es real." }))),
      bloque("Tabla de iteraciones", 3, tabla("Iteraciones de Müller",
        ["i", "x_0", "x_1", "x_2", "x_3", "\\varepsilon_a\\ (\\%)"], filas)),
      seccionProcedimiento("Método de Müller", Procedimiento.muller(f.tex, r, tol), 3, $("m-estado")),
    ];
    return { nodos, estado: `${etiqueta}. Raíz ${compleja ? "compleja" : "real"} aproximada: ${fmt(r.raiz, 8)}.` };
  }

  // -------------------------------------------------------------------------
  // Bairstow
  // -------------------------------------------------------------------------

  function vistaPreviaPolinomio() {
    const caja = $("b-previa");
    try {
      const coefs = leerLista($("b-coefs").value, "Coeficientes", "b-coefs");
      caja.innerHTML = alineado([`f(x) &= ${Metodos.polinomioTex(coefs)}`]);
    } catch (exc) {
      caja.replaceChildren();
    }
  }

  function vistaPreviaIntegral() {
    const caja = $("i-previa");
    try {
      const f = Metodos.crearFuncion($("i-f").value);
      const a = $("i-a").value.trim().replace(",", ".");
      const b = $("i-b").value.trim().replace(",", ".");
      caja.innerHTML = alineado([`I &= \\int_{${a || "a"}}^{${b || "b"}} ${f.tex}\\,dx`]);
    } catch (exc) {
      caja.replaceChildren();
    }
  }

  function resolverBairstow() {
    const coefs = leerLista($("b-coefs").value, "Coeficientes", "b-coefs");
    const r0 = leerNumero("b-r", "r inicial");
    const s0 = leerNumero("b-s", "s inicial");
    const tol = leerTolerancia("b-tol");
    const maxIter = leerIteraciones("b-iter");
    let r;
    try {
      r = Metodos.bairstow(coefs, r0, s0, tol, maxIter);
    } catch (exc) {
      throw new ErrorDeCampo(exc.message, /grado/.test(exc.message) ? "b-coefs" : "b-r");
    }

    const filas = [];
    const detalleFactores = r.factores.map((factor, i) => {
      for (const h of factor.historial) {
        filas.push([`${i + 1} (grado ${factor.grado})`, h.i, fmt(h.r), fmt(h.s), fmt(h.deltaR), fmt(h.deltaS),
          fmt(h.errorR, 4), fmt(h.errorS, 4)]);
      }
      const estado = !factor.historial.length ? "resuelto directamente con la fórmula cuadrática"
        : factor.convergio ? `convergió en ${factor.iteraciones} iteraciones`
          : `no convergió (${factor.iteraciones} iteraciones)`;
      const signo = (v) => (v < 0 ? `+ ${Procedimiento.n(-v, 4)}` : `- ${Procedimiento.n(v, 4)}`);
      return el("li", { html: `Factor ${i + 1}: ${tex(`x^2 ${signo(factor.r)}\\,x ${signo(factor.s)}`)} — ${escapar(estado)}. `
        + `Raíces: ${tex(numTex(factor.raices[0]))} y ${tex(numTex(factor.raices[1]))}.` });
    });

    const etiqueta = r.convergio ? `Se encontraron las ${r.raices.length} raíces` : "Algún factor no convergió";
    const nodos = [
      bloque("Resultado", 3, resumen(r.convergio, etiqueta,
        el("div", { class: "mate", html: alineado([`f(x) &= ${Metodos.polinomioTex(r.polinomio)}`]) }),
        el("div", { class: "valores" }, ...r.raices.map((raiz, i) => el("span", { html: tex(`x_{${i + 1}} = ${numTex(raiz)}`) }))),
        detalleFactores.length ? el("ul", {}, ...detalleFactores) : null,
        r.convergio ? null : el("p", { texto: "Prueba otros valores iniciales de r y s, o más iteraciones." }))),
    ];
    if (filas.length) {
      nodos.push(bloque("Tabla de iteraciones", 3, tabla("Iteraciones de Bairstow por factor cuadrático",
        ["\\text{Factor}", "i", "r", "s", "\\Delta r", "\\Delta s", "\\varepsilon_r\\ (\\%)", "\\varepsilon_s\\ (\\%)"], filas)));
    }
    nodos.push(seccionProcedimiento("Método de Bairstow", Procedimiento.bairstow(r, tol), 3, $("b-estado")));
    return { nodos, estado: `${etiqueta}: ${r.raices.map((x) => fmt(x, 4)).join("; ")}.` };
  }

  // -------------------------------------------------------------------------
  // Diferenciación numérica
  // -------------------------------------------------------------------------

  const radio = (nombre) => document.querySelector(`input[name="${nombre}"]:checked`).value;

  function valorExacto(f, x0) {
    const df = Metodos.derivadaSimbolica(f);
    if (!df) return null;
    try {
      const v = Metodos.comoReal(df(x0));
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    } catch (exc) {
      return null;
    }
  }

  const NOMBRE_TIPO = { progresiva: "progresiva", regresiva: "regresiva", centrada: "centrada" };
  const ORDEN_TEXTO = { "O(h)": "O(h)", "O(h^2)": "O(h²)", "O(h^4)": "O(h⁴)" };

  function resolverDiferenciacion() {
    const f = leerFuncion("d-f", "f(x)");
    const x0 = leerNumero("d-x0", "x0");
    const h = leerNumero("d-h", "Paso h");
    if (h <= 0) throw new ErrorDeCampo("El paso h debe ser mayor que 0.", "d-h");
    const tipo = radio("d-tipo");
    const puntos = Number(radio("d-puntos"));
    const esquema = Metodos.buscarEsquema(tipo, puntos);
    if (!esquema) throw new ErrorDeCampo("La diferencia centrada necesita 3 o 5 puntos; elige otro número de puntos.");

    let r;
    try {
      r = Metodos.derivar(f, x0, h, esquema);
    } catch (exc) {
      throw new ErrorDeCampo(exc.message, "d-x0");
    }
    const exacto = valorExacto(f, x0);
    const errorAbs = exacto === null ? null : Math.abs(r.valor - exacto);

    const filasPuntos = r.puntos.map((p) => [p.k, fmt(p.x, 8), fmt(p.fx, 8), p.coef, fmt(p.coef * p.fx, 8)]);

    const comparacion = Metodos.ESQUEMAS.map((e) => {
      try {
        const c = Metodos.derivar(f, x0, h, e);
        const err = exacto === null ? "—" : Math.abs(c.valor - exacto).toExponential(3);
        return [`${NOMBRE_TIPO[e.tipo]}, ${e.puntos} puntos`, fmt(c.valor, 10), err, ORDEN_TEXTO[e.error] || e.error];
      } catch (exc) {
        return [`${NOMBRE_TIPO[e.tipo]}, ${e.puntos} puntos`, "no definida", "—", e.error];
      }
    });

    const etiqueta = `Diferencia ${NOMBRE_TIPO[tipo]} de ${puntos} puntos`;
    const nodos = [
      bloque("Resultado", 3, resumen(true, etiqueta,
        el("div", { class: "valores" },
          el("span", { html: tex(`f'(${numTex(x0)}) \\approx ${numTex(r.valor, 10)}`) }),
          exacto === null ? null : el("span", { html: tex(`f'(${numTex(x0)}) = ${numTex(exacto, 10)}`) }),
          errorAbs === null ? null : el("span", { html: tex(`\\text{error} = ${errorAbs.toExponential(3)}`) })),
        el("p", { html: `Fórmula: ${tex(`f'(x_0) \\approx \\dfrac{${r.esquema.coefs.map((c, i) => [c, r.esquema.offsets[i]]).filter(([c]) => c !== 0)
          .map(([c, k], i) => `${c < 0 ? "-" : i ? "+" : ""}${Math.abs(c) === 1 ? "" : Math.abs(c)}f_{${k}}`).join(" ")}}{${r.esquema.den === 1 ? "" : r.esquema.den}h}`)}`
          + `, con error ${tex(r.esquema.error.replace(/\^(\d)/, "^{$1}"))}.` }))),
      bloque("Puntos utilizados", 3, tabla("Puntos de la fórmula", ["k", "x_k", "f(x_k)", "\\text{coef.}", "\\text{coef.}\\cdot f(x_k)"], filasPuntos)),
      bloque("Comparación de todas las fórmulas", 3, tabla("Todas las diferencias con el mismo x₀ y h",
        ["\\text{Fórmula}", "f'(x_0)", "\\text{Error absoluto}", "\\text{Orden}"], comparacion)),
      seccionProcedimiento("Diferenciación numérica", Procedimiento.derivada(f.tex, r, exacto), 3, $("d-estado")),
    ];
    return { nodos, estado: `${etiqueta}: f'(${fmt(x0, 4)}) ≈ ${fmt(r.valor, 8)}${exacto === null ? "" : `; valor exacto ${fmt(exacto, 8)}`}.` };
  }

  // -------------------------------------------------------------------------
  // Integración numérica
  // -------------------------------------------------------------------------

  const NOMBRE_METODO = {
    trapecio: "Trapecio compuesto", simpson13: "Simpson 1/3 compuesto", simpson38: "Simpson 3/8 compuesto",
    romberg: "Integración de Romberg", gauss: "Cuadratura de Gauss-Legendre",
  };

  function leerEnteroEn(id, nombre, minimo, maximo) {
    const texto = $(id).value.trim();
    if (!/^\d+$/.test(texto) || Number(texto) < minimo || Number(texto) > maximo) {
      throw new ErrorDeCampo(`«${nombre}» debe ser un entero entre ${minimo} y ${maximo}.`, id);
    }
    return Number(texto);
  }

  function actualizarCamposIntegral() {
    const metodo = $("i-metodo").value;
    document.querySelectorAll("#i-form [data-usa]").forEach((nodo) => {
      nodo.hidden = !nodo.dataset.usa.split(" ").includes(metodo);
    });
  }

  function articuloIntegral(r, f, referencia, estadoNodo) {
    const nombre = NOMBRE_METODO[r.metodo];
    const errorAbs = referencia === null ? null : Math.abs(r.integral - referencia);
    const ok = r.metodo === "romberg" ? r.convergio : true;
    const etiqueta = r.metodo === "romberg"
      ? (r.convergio ? `Convergió en ${r.iteraciones} niveles` : `No convergió en ${r.iteraciones} niveles`)
      : r.metodo === "gauss" ? `${r.n} puntos` : `${r.n} subintervalos`;
    const resultado = bloque("Resultado", 4, resumen(ok, etiqueta,
      el("div", { class: "valores" },
        el("span", { html: tex(`I \\approx ${numTex(r.integral, 10)}`) }),
        referencia === null ? null : el("span", { html: tex(`I_{\\text{ref}} = ${numTex(referencia, 10)}`) }),
        errorAbs === null ? null : el("span", { html: tex(`\\text{error} = ${errorAbs.toExponential(3)}`) })),
      referencia === null ? null : el("p", { class: "nota", texto: "El valor de referencia es numérico (Gauss-Legendre de 10 puntos sobre 16 subintervalos), no una integral exacta." })));

    let tablaNodos;
    let proc;
    if (r.metodo === "romberg") {
      const columnas = r.R.length;
      const cabeceras = ["k", "n", "h", ...Array.from({ length: columnas }, (_, j) => `R_{k,${j}}`), "\\varepsilon_a\\ (\\%)"];
      const filas = r.R.map((fila, k) => [k, r.niveles[k].n, fmt(r.niveles[k].h, 8),
        ...Array.from({ length: columnas }, (_, j) => (j < fila.length ? fmt(fila[j], 8) : "")),
        r.niveles[k].error === null ? "—" : fmt(r.niveles[k].error, 6)]);
      tablaNodos = tabla("Tabla de Romberg", cabeceras, filas);
      proc = Procedimiento.romberg(f.tex, r, referencia);
    } else if (r.metodo === "gauss") {
      const filas = r.nodos.map((q, i) => [i + 1, fmt(q.t, 10), fmt(q.w, 10), fmt(q.x, 10), fmt(q.fx, 10), fmt(q.w * q.fx, 10)]);
      tablaNodos = tabla("Nodos y pesos de Gauss-Legendre", ["i", "t_i", "w_i", "x_i", "f(x_i)", "w_i\\,f(x_i)"], filas);
      proc = Procedimiento.gauss(f.tex, r, referencia);
    } else {
      const filas = r.nodos.map((q) => [q.i, fmt(q.x, 8), fmt(q.fx, 8), q.coef, fmt(q.coef * q.fx, 8)]);
      tablaNodos = tabla("Nodos de la regla", ["i", "x_i", "f(x_i)", "\\text{coef.}", "\\text{coef.}\\cdot f(x_i)"], filas);
      proc = Procedimiento[r.metodo](f.tex, r, referencia);
    }
    return el("article", { class: "metodo" },
      el("h3", { texto: nombre }),
      resultado,
      bloque("Tabla", 4, tablaNodos),
      seccionProcedimiento(nombre, proc, 4, estadoNodo));
  }

  function resolverIntegracion() {
    const f = leerFuncion("i-f", "f(x)");
    const a = leerNumero("i-a", "Límite inferior");
    const b = leerNumero("i-b", "Límite superior");
    if (!(a < b)) throw new ErrorDeCampo("El límite inferior debe ser menor que el superior.", "i-a");
    const metodo = $("i-metodo").value;
    const usa = (m) => metodo === m || metodo === "todos";
    const n = usa("trapecio") || usa("simpson13") || usa("simpson38") ? leerEnteroEn("i-n", "Subintervalos", 1, 100000) : null;
    const tol = usa("romberg") ? leerTolerancia("i-tol") : null;
    const niveles = usa("romberg") ? leerEnteroEn("i-niveles", "Máx. niveles", 1, 20) : null;
    const puntos = usa("gauss") ? leerEnteroEn("i-puntos", "Puntos de Gauss", 1, 30) : null;

    const corridas = [];
    const omitidos = [];
    const correr = (m, id, fn) => {
      try {
        corridas.push(fn());
      } catch (exc) {
        if (metodo === "todos" && /múltiplo|par/.test(exc.message)) omitidos.push(`${NOMBRE_METODO[m]}: ${exc.message}`);
        else throw new ErrorDeCampo(exc.message, id);
      }
    };
    if (usa("trapecio")) correr("trapecio", "i-n", () => Metodos.trapecio(f, a, b, n));
    if (usa("simpson13")) correr("simpson13", "i-n", () => Metodos.simpson13(f, a, b, n));
    if (usa("simpson38")) correr("simpson38", "i-n", () => Metodos.simpson38(f, a, b, n));
    if (usa("romberg")) correr("romberg", "i-niveles", () => Metodos.romberg(f, a, b, tol, niveles));
    if (usa("gauss")) correr("gauss", "i-puntos", () => Metodos.gaussLegendre(f, a, b, puntos));

    let referencia = null;
    try {
      const v = Metodos.integralReferencia(f, a, b);
      if (Number.isFinite(v)) referencia = v;
    } catch (exc) {
      referencia = null;
    }

    const estadoNodo = $("i-estado");
    const nodos = [];
    if (metodo === "todos") {
      const filas = corridas.map((r) => [NOMBRE_METODO[r.metodo], fmt(r.integral, 10),
        referencia === null ? "—" : Math.abs(r.integral - referencia).toExponential(3)]);
      nodos.push(bloque("Comparación de métodos", 3, tabla("Todos los métodos aplicados a la misma integral",
        ["\\text{Método}", "I", "\\text{Error absoluto}"], filas)));
      if (omitidos.length) nodos.push(el("p", { class: "nota", texto: `No aplicados: ${omitidos.join(" ")}` }));
    }
    for (const r of corridas) nodos.push(articuloIntegral(r, f, referencia, estadoNodo));

    const frases = corridas.map((r) => `${NOMBRE_METODO[r.metodo]}: ${fmt(r.integral, 8)}`);
    return { nodos, estado: `Integral calculada. ${frases.join(". ")}.` };
  }

  // -------------------------------------------------------------------------
  // Pestañas (patrón ARIA: flechas, Inicio y Fin)
  // -------------------------------------------------------------------------

  const pestanas = Array.from(document.querySelectorAll('[role="tab"]'));

  function activarPestana(pestana, enfocar = false) {
    for (const p of pestanas) {
      const activa = p === pestana;
      p.setAttribute("aria-selected", String(activa));
      p.tabIndex = activa ? 0 : -1;
      $(p.getAttribute("aria-controls")).hidden = !activa;
    }
    if (enfocar) pestana.focus();
    history.replaceState(null, "", `#${pestana.id.replace("tab-", "")}`);
  }

  pestanas.forEach((pestana, i) => {
    pestana.addEventListener("click", () => activarPestana(pestana));
    pestana.addEventListener("keydown", (evento) => {
      const destino = {
        ArrowRight: pestanas[(i + 1) % pestanas.length],
        ArrowLeft: pestanas[(i - 1 + pestanas.length) % pestanas.length],
        Home: pestanas[0],
        End: pestanas[pestanas.length - 1],
      }[evento.key];
      if (destino) {
        evento.preventDefault();
        activarPestana(destino, true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Arranque
  // -------------------------------------------------------------------------

  document.querySelectorAll(".tex[data-tex]").forEach((nodo) => { nodo.innerHTML = tex(nodo.dataset.tex); });

  ["s-a", "s-b"].forEach((id) => $(id).addEventListener("input", vistaPreviaSistema));
  ["n-f", "n-df"].forEach((id) => $(id).addEventListener("input", vistaPreviaNewton));
  $("m-f").addEventListener("input", () => vistaPreviaFuncion("m-f", "m-previa"));
  $("b-coefs").addEventListener("input", vistaPreviaPolinomio);

  conectar("s", resolverSistemas,
    { "s-a": "20 1 -1\n3 20 1\n2 -3 20", "s-b": "17 -18 25", "s-x0": "", "s-tol": "1e-6", "s-iter": "100" },
    (ejemplo) => { ponerValores(ejemplo); document.querySelector('input[name="s-metodo"][value="ambos"]').checked = true; });
  // Ejemplos 6.3, 7.2 y 7.3 de Chapra & Canale
  conectar("n", resolverNewton,
    { "n-f": "exp(-x) - x", "n-df": "", "n-x0": "0", "n-tol": "0.0001", "n-iter": "100" }, ponerValores);
  conectar("m", resolverMuller,
    { "m-f": "x^3 - 13x - 12", "m-x0": "4.5", "m-x1": "5.5", "m-x2": "5", "m-tol": "0.0001", "m-iter": "100" }, ponerValores);
  conectar("b", resolverBairstow,
    { "b-coefs": "1 -3.5 2.75 2.125 -3.875 1.25", "b-r": "-1", "b-s": "-1", "b-tol": "1", "b-iter": "100" }, ponerValores);

  $("d-f").addEventListener("input", () => vistaPreviaFuncion("d-f", "d-previa"));
  $("i-f").addEventListener("input", vistaPreviaIntegral);
  ["i-a", "i-b"].forEach((id) => $(id).addEventListener("input", vistaPreviaIntegral));
  $("i-metodo").addEventListener("change", actualizarCamposIntegral);

  conectar("d", resolverDiferenciacion,
    { "d-f": "sin(x)", "d-x0": "1", "d-h": "0.1" },
    (ejemplo) => {
      ponerValores(ejemplo);
      document.querySelector('input[name="d-tipo"][value="progresiva"]').checked = true;
      document.querySelector('input[name="d-puntos"][value="3"]').checked = true;
    });
  // Polinomio de Chapra & Canale (ejemplo de integración): valor exacto 1.640533
  conectar("i", resolverIntegracion,
    { "i-f": "0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5", "i-a": "0", "i-b": "0.8", "i-n": "6",
      "i-tol": "0.0001", "i-niveles": "10", "i-puntos": "3" },
    (ejemplo) => { ponerValores(ejemplo); $("i-metodo").value = "todos"; actualizarCamposIntegral(); });

  const inicial = $(`tab-${location.hash.slice(1)}`);
  if (inicial) activarPestana(inicial);
})();

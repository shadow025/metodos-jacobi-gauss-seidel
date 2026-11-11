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

  const inicial = $(`tab-${location.hash.slice(1)}`);
  if (inicial) activarPestana(inicial);
})();

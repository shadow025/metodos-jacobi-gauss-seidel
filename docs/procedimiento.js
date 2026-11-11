/*
 * Genera el procedimiento paso a paso de cada método en LaTeX.
 *
 * Cada función devuelve una lista de bloques:
 *   { tipo: "h",   texto }    título de un paso
 *   { tipo: "sub", texto }    subtítulo (una iteración)
 *   { tipo: "p",   texto }    párrafo; puede llevar matemática en línea entre $...$
 *   { tipo: "m",   lineas }   ecuaciones alineadas por el símbolo &
 *
 * app.js los dibuja con KaTeX y aLatex() los convierte en código LaTeX para
 * pegar en un documento.
 */
/* global Metodos */
"use strict";

const Procedimiento = (() => {
  const { fmt, fijo, esComplejo, esDiagonalmenteDominante, polinomioTex } = Metodos;
  const MAX_ITERACIONES_DETALLADAS = 15;

  /** Número sin ceros sobrantes: 1.5, -0.25, 3. */
  function n(v, d = 6) {
    if (esComplejo(v)) return fmt(v, d);
    if (Number.isNaN(v)) return "\\text{indefinido}";
    if (!Number.isFinite(v)) return v > 0 ? "\\infty" : "-\\infty";
    if (Number.isInteger(v) && Math.abs(v) < 1e12) return String(v);
    const texto = fijo(v, d).replace(/0+$/, "").replace(/\.$/, "");
    return texto === "-0" ? "0" : texto;
  }

  /** Igual que n() pero entre paréntesis si es negativo o complejo. */
  function p(v, d = 6) {
    const texto = n(v, d);
    return texto.startsWith("-") || esComplejo(v) ? `(${texto})` : texto;
  }

  const frac = (a, b) => `\\frac{${a}}{${b}}`;
  const h = (texto) => ({ tipo: "h", texto });
  const sub = (texto) => ({ tipo: "sub", texto });
  const par = (texto) => ({ tipo: "p", texto });
  const mat = (...lineas) => ({ tipo: "m", lineas: lineas.flat() });

  /** 20x_1 + x_2 - x_3 &= 17 */
  function ecuacionTex(fila, bi) {
    let texto = "";
    fila.forEach((c, j) => {
      if (c === 0) return;
      const mag = Math.abs(c) === 1 ? "" : n(Math.abs(c));
      const termino = `${mag}x_{${j + 1}}`;
      if (!texto) texto = (c < 0 ? "-" : "") + termino;
      else texto += ` ${c < 0 ? "-" : "+"} ${termino}`;
    });
    return `${texto || "0"} &= ${n(bi)}`;
  }

  // -------------------------------------------------------------------------
  // Jacobi / Gauss-Seidel
  // -------------------------------------------------------------------------

  function sistema(nombre, A, b, resultado, tol) {
    const N = A.length;
    const esGS = /^gauss/i.test(nombre);
    const B = [];

    B.push(h("Sistema de ecuaciones"));
    B.push(mat(A.map((fila, i) => ecuacionTex(fila, b[i]))));

    B.push(h("Paso 1. Verificar la dominancia diagonal"));
    B.push(par("Se comprueba en cada fila que $|a_{ii}| > \\sum_{j \\neq i} |a_{ij}|$:"));
    B.push(mat(A.map((fila, i) => {
      const resto = fila.filter((_, j) => j !== i).map(Math.abs);
      const suma = resto.reduce((s, v) => s + v, 0);
      const ok = Math.abs(fila[i]) > suma;
      const detalle = resto.length > 1 ? `${resto.map((v) => n(v)).join(" + ")} = ${n(suma)}` : n(suma);
      return `\\text{Fila ${i + 1}:}\\quad & |${n(fila[i])}| = ${n(Math.abs(fila[i]))} ${ok ? ">" : "\\le"} ${detalle} `
        + `\\quad ${ok ? "\\checkmark" : "\\times"}`;
    })));
    B.push(par(esDiagonalmenteDominante(A)
      ? "La matriz es diagonalmente dominante: la convergencia está garantizada."
      : "La matriz no es diagonalmente dominante: el método puede converger o no. Si diverge, reordena las ecuaciones."));

    B.push(h("Paso 2. Despejar la incógnita de la diagonal"));
    B.push(mat(A.map((fila, i) => {
      let numerador = n(b[i]);
      fila.forEach((c, j) => {
        if (j === i || c === 0) return;
        const k = esGS && j < i ? "k+1" : "k";
        numerador += ` - ${p(c)}\\,x_{${j + 1}}^{(${k})}`;
      });
      return `x_{${i + 1}}^{(k+1)} &= ${frac(numerador, n(fila[i]))}`;
    })));
    B.push(par(esGS
      ? "En Gauss-Seidel cada incógnita usa de inmediato los valores ya calculados en la misma iteración (los de superíndice $(k+1)$)."
      : "En Jacobi todas las incógnitas usan los valores de la iteración anterior (superíndice $(k)$)."));

    const historial = resultado.historial;
    B.push(h("Paso 3. Iterar"));
    B.push(par(`Se parte de $\\mathbf{x}^{(0)} = (${historial[0].map((v) => n(v)).join(",\\ ")})$ y se repite hasta que `
      + `$\\max_i \\left|x_i^{(k+1)} - x_i^{(k)}\\right| < ${n(tol, 10)}$.`));

    const total = historial.length - 1;
    for (let k = 1; k <= total; k++) {
      if (k > MAX_ITERACIONES_DETALLADAS) {
        B.push(par(`Las iteraciones ${k} a ${total} se calculan igual; sus valores están en la tabla.`));
        break;
      }
      const previo = historial[k - 1];
      const nuevo = historial[k];
      B.push(sub(`Iteración ${k}`));
      const lineas = A.map((fila, i) => {
        let numerador = n(b[i]);
        fila.forEach((c, j) => {
          if (j === i || c === 0) return;
          const valor = esGS && j < i ? nuevo[j] : previo[j];
          numerador += ` - ${p(c)} \\cdot ${p(valor)}`;
        });
        return `x_{${i + 1}}^{(${k})} &= ${frac(numerador, n(fila[i]))} = ${n(nuevo[i])}`;
      });
      const difs = nuevo.map((v, i) => Math.abs(v - previo[i]));
      lineas.push(`\\text{Error} &= \\max(${difs.map((d) => n(d)).join(",\\ ")}) = ${n(Math.max(...difs))}`);
      B.push(mat(lineas));
    }

    B.push(h("Paso 4. Resultado"));
    if (resultado.convergio) {
      B.push(par(`El error bajó de la tolerancia en la iteración ${resultado.iteraciones}: el método convergió.`));
    } else if (resultado.divergio) {
      B.push(par(`El método divergió en la iteración ${resultado.iteraciones} (los valores crecen sin límite).`));
    } else {
      B.push(par(`Se alcanzó el máximo de ${resultado.iteraciones} iteraciones sin cumplir la tolerancia.`));
    }
    B.push(mat(resultado.x.map((v, i) => `x_{${i + 1}} &\\approx ${fmt(v)}`).map((l) => l.replace("∞", "\\infty"))));
    return B;
  }

  // -------------------------------------------------------------------------
  // Newton-Raphson
  // -------------------------------------------------------------------------

  function newton(texF, texDf, resultado, tol) {
    const B = [];
    B.push(h("Planteamiento"));
    B.push(mat(`f(x) &= ${texF}`, `f'(x) &${texDf ? `= ${texDf}` : "\\approx \\frac{f(x+h) - f(x-h)}{2h} \\quad \\text{(derivada numérica)}"}`));
    B.push(par("Fórmula de Newton-Raphson y error relativo porcentual aproximado:"));
    B.push(mat(
      "x_{i+1} &= x_i - \\frac{f(x_i)}{f'(x_i)}",
      "\\varepsilon_a &= \\left|\\frac{x_{i+1} - x_i}{x_{i+1}}\\right| \\cdot 100\\,\\%",
    ));
    const historial = resultado.historial;
    B.push(par(`Se parte de $x_0 = ${n(historial[0].x)}$ y se detiene cuando $\\varepsilon_a < \\varepsilon_s = ${n(tol, 10)}\\,\\%$.`));

    B.push(h("Iteraciones"));
    for (const it of historial) {
      const i = it.i;
      if (i >= MAX_ITERACIONES_DETALLADAS) {
        B.push(par(`Las iteraciones ${i} a ${historial.length - 1} se calculan igual; sus valores están en la tabla.`));
        break;
      }
      B.push(sub(`Iteración ${i}`));
      const lineas = [
        `f(x_{${i}}) &= f(${n(it.x, 8)}) = ${n(it.fx, 8)}`,
        `f'(x_{${i}}) &= f'(${n(it.x, 8)}) = ${n(it.dfx, 8)}`,
        `x_{${i + 1}} &= ${n(it.x, 8)} - ${frac(n(it.fx, 8), n(it.dfx, 8))} = ${n(it.xNuevo, 8)}`,
        `\\varepsilon_a &= \\left|${frac(`${n(it.xNuevo, 8)} - ${p(it.x, 8)}`, n(it.xNuevo, 8))}\\right| \\cdot 100\\,\\% = ${n(it.error, 6)}\\,\\%`,
      ];
      B.push(mat(lineas));
      if (it.error < tol) {
        B.push(par(`Como $${n(it.error, 6)}\\,\\% < ${n(tol, 10)}\\,\\%$, se detiene.`));
      }
    }

    B.push(h("Resultado"));
    B.push(par(resultado.convergio
      ? `Convergió en ${resultado.iteraciones} iteraciones.`
      : `No convergió en ${resultado.iteraciones} iteraciones (revisa el valor inicial).`));
    B.push(mat(`x &\\approx ${fmt(resultado.raiz, 8)}`, `f(x) &= ${n(resultado.fRaiz, 10)}`));
    return B;
  }

  // -------------------------------------------------------------------------
  // Müller
  // -------------------------------------------------------------------------

  function muller(texF, resultado, tol) {
    const B = [];
    B.push(h("Planteamiento"));
    B.push(mat(`f(x) &= ${texF}`));
    B.push(par("Por los tres puntos $x_0, x_1, x_2$ pasa una parábola; su raíz más cercana a $x_2$ es la nueva aproximación $x_3$:"));
    B.push(mat(
      "h_0 &= x_1 - x_0, \\qquad h_1 = x_2 - x_1",
      "\\delta_0 &= \\frac{f(x_1) - f(x_0)}{h_0}, \\qquad \\delta_1 = \\frac{f(x_2) - f(x_1)}{h_1}",
      "a &= \\frac{\\delta_1 - \\delta_0}{h_1 + h_0}, \\qquad b = a\\,h_1 + \\delta_1, \\qquad c = f(x_2)",
      "x_3 &= x_2 - \\frac{2c}{b \\pm \\sqrt{b^2 - 4ac}}",
      "\\varepsilon_a &= \\left|\\frac{x_3 - x_2}{x_3}\\right| \\cdot 100\\,\\%",
    ));
    B.push(par(`Se toma el signo que hace mayor la magnitud del denominador. Después $x_0 \\leftarrow x_1$, $x_1 \\leftarrow x_2$, $x_2 \\leftarrow x_3$. `
      + `Se detiene cuando $\\varepsilon_a < \\varepsilon_s = ${n(tol, 10)}\\,\\%$.`));

    B.push(h("Iteraciones"));
    const historial = resultado.historial;
    for (const it of historial) {
      if (it.i > MAX_ITERACIONES_DETALLADAS) {
        B.push(par(`Las iteraciones ${it.i} a ${historial.length} se calculan igual; sus valores están en la tabla.`));
        break;
      }
      B.push(sub(`Iteración ${it.i}`));
      B.push(mat(
        `x_0 &= ${n(it.x0)}, \\qquad x_1 = ${n(it.x1)}, \\qquad x_2 = ${n(it.x2)}`,
        `f(x_0) &= ${n(it.fx0)}, \\qquad f(x_1) = ${n(it.fx1)}, \\qquad f(x_2) = ${n(it.fx2)}`,
        `h_0 &= ${n(it.x1)} - ${p(it.x0)} = ${n(it.h0)}`,
        `h_1 &= ${n(it.x2)} - ${p(it.x1)} = ${n(it.h1)}`,
        `\\delta_0 &= ${frac(`${n(it.fx1)} - ${p(it.fx0)}`, n(it.h0))} = ${n(it.d0)}`,
        `\\delta_1 &= ${frac(`${n(it.fx2)} - ${p(it.fx1)}`, n(it.h1))} = ${n(it.d1)}`,
        `a &= ${frac(`${n(it.d1)} - ${p(it.d0)}`, `${n(it.h1)} + ${p(it.h0)}`)} = ${n(it.a)}`,
        `b &= ${p(it.a)} \\cdot ${p(it.h1)} + ${p(it.d1)} = ${n(it.b)}`,
        `c &= f(x_2) = ${n(it.c)}`,
        `\\sqrt{b^2 - 4ac} &= \\sqrt{${p(it.b)}^2 - 4 \\cdot ${p(it.a)} \\cdot ${p(it.c)}} = \\sqrt{${n(it.radicando)}} = ${n(it.discriminante)}`,
        `x_3 &= ${n(it.x2)} - ${frac(`2 \\cdot ${p(it.c)}`, n(it.denominador))} = ${n(it.x3)}`,
        `\\varepsilon_a &= \\left|${frac(`${n(it.x3)} - ${p(it.x2)}`, n(it.x3))}\\right| \\cdot 100\\,\\% = ${n(it.error)}\\,\\%`,
      ));
      if (it.error < tol) {
        B.push(par(`Como $${n(it.error)}\\,\\% < ${n(tol, 10)}\\,\\%$, se detiene.`));
      }
    }

    B.push(h("Resultado"));
    B.push(par(resultado.convergio
      ? `Convergió en ${resultado.iteraciones} iteraciones.`
      : `No convergió en ${resultado.iteraciones} iteraciones.`));
    B.push(mat(`x &\\approx ${fmt(resultado.raiz, 8)}`, `f(x) &= ${n(resultado.fRaiz, 10)}`));
    if (esComplejo(resultado.raiz)) {
      B.push(par(`La raíz es compleja; su conjugada $${fmt(resultado.raiz.conjugate(), 8)}$ también es raíz.`));
    }
    return B;
  }

  // -------------------------------------------------------------------------
  // Bairstow
  // -------------------------------------------------------------------------

  function recurrencia(letra, fuente, a, valores, r, s, hasta) {
    const N = a.length - 1;
    const L = [];
    L.push(`${letra}_{${N}} &= ${fuente}_{${N}} = ${n(valores[N])}`);
    L.push(`${letra}_{${N - 1}} &= ${fuente}_{${N - 1}} + r\\,${letra}_{${N}} = ${n(a[N - 1])} + ${p(r)} \\cdot ${p(valores[N])} = ${n(valores[N - 1])}`);
    for (let i = N - 2; i >= hasta; i--) {
      L.push(`${letra}_{${i}} &= ${fuente}_{${i}} + r\\,${letra}_{${i + 1}} + s\\,${letra}_{${i + 2}} = `
        + `${n(a[i])} + ${p(r)} \\cdot ${p(valores[i + 1])} + ${p(s)} \\cdot ${p(valores[i + 2])} = ${n(valores[i])}`);
    }
    return L;
  }

  function bairstow(resultado, tol) {
    const B = [];
    B.push(h("Planteamiento"));
    B.push(mat(`f(x) &= ${polinomioTex(resultado.polinomio)}`));
    B.push(par("Se divide el polinomio entre el factor cuadrático $x^2 - r\\,x - s$ y se corrigen $r$ y $s$ hasta que el residuo sea cero:"));
    B.push(mat(
      "b_n &= a_n, \\qquad b_{n-1} = a_{n-1} + r\\,b_n, \\qquad b_i = a_i + r\\,b_{i+1} + s\\,b_{i+2}",
      "c_n &= b_n, \\qquad c_{n-1} = b_{n-1} + r\\,c_n, \\qquad c_i = b_i + r\\,c_{i+1} + s\\,c_{i+2}",
    ));
    B.push(mat("\\begin{cases} c_2\\,\\Delta r + c_3\\,\\Delta s = -b_1 \\\\ c_1\\,\\Delta r + c_2\\,\\Delta s = -b_0 \\end{cases}"));
    B.push(mat(
      "r &\\leftarrow r + \\Delta r, \\qquad s \\leftarrow s + \\Delta s",
      "\\varepsilon_r &= \\left|\\frac{\\Delta r}{r}\\right| \\cdot 100\\,\\%, \\qquad \\varepsilon_s = \\left|\\frac{\\Delta s}{s}\\right| \\cdot 100\\,\\%",
      "x &= \\frac{r \\pm \\sqrt{r^2 + 4s}}{2}",
    ));
    B.push(par(`Se detiene cuando $\\varepsilon_r$ y $\\varepsilon_s$ son menores que $${n(tol, 10)}\\,\\%$.`));

    resultado.factores.forEach((factor, indice) => {
      const coefs = factor.polinomio;
      const a = coefs.slice().reverse();
      const N = a.length - 1;
      B.push(h(`Factor ${indice + 1}: polinomio de grado ${N}`));
      B.push(mat(`f_{${indice + 1}}(x) &= ${polinomioTex(coefs)}`));
      B.push(par("Coeficientes: " + a.map((v, i) => `$a_{${i}} = ${n(v)}$`).reverse().join(", ") + "."));

      if (!factor.historial.length) {
        B.push(par("Es de grado 2: se resuelve directamente con la fórmula cuadrática, escribiéndolo como $x^2 - r\\,x - s$:"));
        B.push(mat(`r &= -\\frac{a_1}{a_2} = ${n(factor.r)}, \\qquad s = -\\frac{a_0}{a_2} = ${n(factor.s)}`));
      } else {
        for (const it of factor.historial) {
          if (it.i > MAX_ITERACIONES_DETALLADAS) {
            B.push(par(`Las iteraciones ${it.i} a ${factor.iteraciones} se calculan igual; sus valores están en la tabla.`));
            break;
          }
          const { r, s, b, c } = it;
          B.push(sub(`Iteración ${it.i}`));
          B.push(par(`Con $r = ${n(r)}$ y $s = ${n(s)}$, coeficientes $b$ (división sintética) y $c$:`));
          B.push(mat(recurrencia("b", "a", a, b, r, s, 0)));
          B.push(mat(recurrencia("c", "b", b, c, r, s, 1)));
          B.push(par("Sistema para $\\Delta r$ y $\\Delta s$:"));
          B.push(mat(`\\begin{cases} ${p(c[2])}\\,\\Delta r + ${p(c[3])}\\,\\Delta s = ${n(-b[1])} \\\\ `
            + `${p(c[1])}\\,\\Delta r + ${p(c[2])}\\,\\Delta s = ${n(-b[0])} \\end{cases}`));
          B.push(mat(
            `\\text{Determinante} &= ${p(c[2])}^2 - ${p(c[3])} \\cdot ${p(c[1])} = ${n(it.det)}`,
            `\\Delta r &= ${frac(`${p(-b[1])} \\cdot ${p(c[2])} - ${p(-b[0])} \\cdot ${p(c[3])}`, n(it.det))} = ${n(it.deltaR)}`,
            `\\Delta s &= ${frac(`${p(c[2])} \\cdot ${p(-b[0])} - ${p(c[1])} \\cdot ${p(-b[1])}`, n(it.det))} = ${n(it.deltaS)}`,
            `r &= ${n(r)} + ${p(it.deltaR)} = ${n(it.rNuevo)}`,
            `s &= ${n(s)} + ${p(it.deltaS)} = ${n(it.sNuevo)}`,
            `\\varepsilon_r &= \\left|${frac(n(it.deltaR), n(it.rNuevo))}\\right| \\cdot 100\\,\\% = ${n(it.errorR, 4)}\\,\\%`,
            `\\varepsilon_s &= \\left|${frac(n(it.deltaS), n(it.sNuevo))}\\right| \\cdot 100\\,\\% = ${n(it.errorS, 4)}\\,\\%`,
          ));
          if (it.errorR < tol && it.errorS < tol) {
            B.push(par(`Ambos errores son menores que $${n(tol, 10)}\\,\\%$: el factor convergió.`));
          }
        }
        if (!factor.convergio) {
          B.push(par(`Atención: se alcanzó el máximo de ${factor.iteraciones} iteraciones sin converger.`));
        }
      }

      const { r, s } = factor;
      const [x1, x2] = factor.raices;
      B.push(sub(`Raíces del factor ${indice + 1}`));
      B.push(mat(
        `\\text{Factor:}\\quad & x^2 - ${p(r)}\\,x - ${p(s)}`,
        `x &= ${frac(`${n(r)} \\pm \\sqrt{${p(r)}^2 + 4 \\cdot ${p(s)}}`, "2")} = ${frac(`${n(r)} \\pm \\sqrt{${n(r * r + 4 * s)}}`, "2")}`,
        `x &= ${fmt(x1)}, \\qquad x = ${fmt(x2)}`,
      ));
      if (factor.cociente) {
        const q = factor.cociente;
        B.push(par(`Polinomio reducido (cociente $b_{${N}} \\dots b_2$):`));
        B.push(mat(`& ${polinomioTex(q)}`));
        if (q.length === 2) {
          B.push(par("Es de grado 1, así que su raíz se despeja directamente:"));
          B.push(mat(`x &= -${frac(p(q[1]), n(q[0]))} = ${n(-q[1] / q[0])}`));
        }
      }
    });

    B.push(h("Raíces del polinomio"));
    B.push(mat(resultado.raices.map((raiz, i) => `x_{${i + 1}} &= ${fmt(raiz)}`)));
    if (!resultado.convergio) {
      B.push(par("Atención: algún factor no convergió. Prueba otros valores iniciales de r y s."));
    }
    return B;
  }

  // -------------------------------------------------------------------------
  // Exportar a código LaTeX
  // -------------------------------------------------------------------------

  function aLatex(titulo, bloques) {
    const partes = [`\\section*{${titulo}}`];
    for (const b of bloques) {
      if (b.tipo === "h") partes.push(`\\subsection*{${b.texto}}`);
      else if (b.tipo === "sub") partes.push(`\\subsubsection*{${b.texto}}`);
      else if (b.tipo === "p") partes.push(b.texto);
      else partes.push(`\\begin{align*}\n${b.lineas.map((l) => "  " + l).join(" \\\\\n")}\n\\end{align*}`);
    }
    return partes.join("\n\n") + "\n";
  }

  // -------------------------------------------------------------------------
  // Diferenciación numérica
  // -------------------------------------------------------------------------

  /** "-3f_{0} + 4f_{1} - f_{2}" (omite los coeficientes cero). */
  function combinacionTex(offsets, coefs) {
    let texto = "";
    offsets.forEach((k, i) => {
      const c = coefs[i];
      if (c === 0) return;
      const mag = Math.abs(c) === 1 ? "" : String(Math.abs(c));
      const termino = `${mag}f_{${k}}`;
      if (!texto) texto = (c < 0 ? "-" : "") + termino;
      else texto += ` ${c < 0 ? "-" : "+"} ${termino}`;
    });
    return texto;
  }

  const NOMBRE_TIPO = { progresiva: "progresiva (hacia adelante)", regresiva: "regresiva (hacia atrás)", centrada: "centrada" };

  function derivada(texF, r, exacto) {
    const e = r.esquema;
    const B = [];
    B.push(h("Planteamiento"));
    B.push(mat(`f(x) &= ${texF}`));
    B.push(par(`Se aproxima $f'(x_0)$ con la diferencia ${NOMBRE_TIPO[e.tipo]} de ${e.puntos} puntos, `
      + "donde $x_k = x_0 + k\\,h$ y $f_k = f(x_k)$:"));
    B.push(mat(
      `f'(x_0) &\\approx ${frac(combinacionTex(e.offsets, e.coefs), `${e.den === 1 ? "" : e.den}h`)}`,
      `\\text{Error de truncamiento} &= ${e.error}`,
    ));
    B.push(par(`Datos: $x_0 = ${n(r.x0)}$ y $h = ${n(r.h, 10)}$.`));

    B.push(h("Paso 1. Evaluar la función en los puntos"));
    B.push(mat(r.puntos.map((p) =>
      `x_{${p.k}} &= ${n(r.x0)} ${p.k < 0 ? "-" : "+"} ${Math.abs(p.k)} \\cdot ${n(r.h, 10)} = ${n(p.x, 10)}`
      + `, \\qquad f_{${p.k}} = f(${n(p.x, 10)}) = ${n(p.fx, 10)}`)));

    B.push(h("Paso 2. Sustituir en la fórmula"));
    const usados = r.puntos.filter((p) => p.coef !== 0);
    const terminos = usados.map((pt, i) => {
      const mag = `${Math.abs(pt.coef)} \\cdot ${p(pt.fx, 10)}`;
      if (i === 0) return pt.coef < 0 ? `-${mag}` : mag;
      return `${pt.coef < 0 ? "-" : "+"} ${mag}`;
    }).join(" ");
    B.push(mat(
      `f'(x_0) &\\approx ${frac(terminos, `${e.den} \\cdot ${n(r.h, 10)}`)}`,
      `&= ${frac(n(r.numerador, 12), n(e.den * r.h, 12))}`,
      `&= ${n(r.valor, 10)}`,
    ));

    B.push(h("Resultado"));
    B.push(mat(`f'(${n(r.x0)}) &\\approx ${n(r.valor, 10)}`));
    if (exacto !== null && exacto !== undefined) {
      const abs = Math.abs(r.valor - exacto);
      B.push(par("Comparación con la derivada exacta:"));
      B.push(mat(
        `f'(${n(r.x0)}) &= ${n(exacto, 10)}`,
        `\\text{Error absoluto} &= |${n(r.valor, 10)} - ${p(exacto, 10)}| = ${abs.toExponential(4)}`,
        ...(exacto !== 0 ? [`\\text{Error relativo} &= ${n(abs / Math.abs(exacto) * 100, 8)}\\,\\%`] : []),
      ));
    }
    return B;
  }

  // -------------------------------------------------------------------------
  // Integración numérica
  // -------------------------------------------------------------------------

  /** Suma de términos "coef·f(x)" abreviada si hay demasiados. */
  function listaTerminos(nodos) {
    const MAX = 12;
    const texto = (pt) => `${pt.coef === 1 ? "" : `${pt.coef}\\cdot`}${p(pt.fx, 8)}`;
    if (nodos.length <= MAX) return nodos.map(texto).join(" + ");
    return `${nodos.slice(0, 4).map(texto).join(" + ")} + \\cdots + ${nodos.slice(-3).map(texto).join(" + ")}`;
  }

  function integralCompuesta(titulo, formula, factor, r, texF, extra) {
    const B = [];
    B.push(h("Planteamiento"));
    B.push(mat(`I &= \\int_{${n(r.a)}}^{${n(r.b)}} ${texF}\\,dx`));
    B.push(par(`${titulo} con $n = ${r.n}$ subintervalos de ancho $h = \\dfrac{b - a}{n}$:`));
    B.push(mat(formula));
    if (extra) B.push(par(extra));
    B.push(h("Paso 1. Ancho de cada subintervalo"));
    B.push(mat(`h &= ${frac(`${n(r.b)} - ${p(r.a)}`, String(r.n))} = ${n(r.h, 10)}`));
    B.push(h("Paso 2. Evaluar la función en los nodos"));
    B.push(par("Los nodos son $x_i = a + i\\,h$; los coeficientes y valores completos están en la tabla."));
    const MAX = 12;
    const mostrar = r.nodos.length <= MAX ? r.nodos : [...r.nodos.slice(0, 4), ...r.nodos.slice(-3)];
    B.push(mat(mostrar.map((pt) => `f(x_{${pt.i}}) &= f(${n(pt.x, 8)}) = ${n(pt.fx, 8)}`)));
    if (r.nodos.length > MAX) B.push(par("Se muestran solo los primeros y últimos nodos; el resto está en la tabla."));
    B.push(h("Paso 3. Sustituir en la fórmula"));
    B.push(mat(
      `I &\\approx ${factor(r)} \\left[ ${listaTerminos(r.nodos)} \\right]`,
      `&= ${factor(r)} \\cdot ${n(r.suma, 10)}`,
      `&= ${n(r.integral, 10)}`,
    ));
    return B;
  }

  const cierreIntegral = (B, r, referencia) => {
    B.push(h("Resultado"));
    B.push(mat(`I &\\approx ${n(r.integral, 10)}`));
    if (referencia !== null && referencia !== undefined && Number.isFinite(referencia)) {
      const abs = Math.abs(r.integral - referencia);
      B.push(par("Comparación con un valor de referencia (Gauss-Legendre de 10 puntos sobre 16 subintervalos):"));
      B.push(mat(
        `I_{\\text{ref}} &= ${n(referencia, 10)}`,
        `\\text{Error absoluto} &= ${abs.toExponential(4)}`,
        ...(referencia !== 0 ? [`\\text{Error relativo} &= ${n(abs / Math.abs(referencia) * 100, 8)}\\,\\%`] : []),
      ));
    }
    return B;
  };

  function trapecio(texF, r, referencia) {
    const B = integralCompuesta("Regla del trapecio compuesta",
      "I \\approx \\frac{h}{2}\\left[f(x_0) + 2\\sum_{i=1}^{n-1} f(x_i) + f(x_n)\\right]",
      (q) => `\\frac{${n(q.h, 10)}}{2}`, r, texF,
      "Error de truncamiento: $O(h^2)$. Cada subintervalo se aproxima con una recta.");
    return cierreIntegral(B, r, referencia);
  }

  function simpson13(texF, r, referencia) {
    const B = integralCompuesta("Regla de Simpson 1/3 compuesta",
      "I \\approx \\frac{h}{3}\\left[f(x_0) + 4\\sum_{i\\ \\text{impar}} f(x_i) + 2\\sum_{i\\ \\text{par}} f(x_i) + f(x_n)\\right]",
      (q) => `\\frac{${n(q.h, 10)}}{3}`, r, texF,
      "Requiere $n$ par. Error de truncamiento: $O(h^4)$. Cada par de subintervalos se aproxima con una parábola.");
    return cierreIntegral(B, r, referencia);
  }

  function simpson38(texF, r, referencia) {
    const B = integralCompuesta("Regla de Simpson 3/8 compuesta",
      "I \\approx \\frac{3h}{8}\\left[f(x_0) + 3\\sum_{i\\not\\equiv 0\\,(3)} f(x_i) + 2\\sum_{i\\equiv 0\\,(3)} f(x_i) + f(x_n)\\right]",
      (q) => `\\frac{3 \\cdot ${n(q.h, 10)}}{8}`, r, texF,
      "Requiere $n$ múltiplo de 3. Error de truncamiento: $O(h^4)$. Cada tres subintervalos se aproximan con una cúbica.");
    return cierreIntegral(B, r, referencia);
  }

  function romberg(texF, r, referencia) {
    const B = [];
    B.push(h("Planteamiento"));
    B.push(mat(`I &= \\int_{${n(r.a)}}^{${n(r.b)}} ${texF}\\,dx`));
    B.push(par("Romberg mejora la regla del trapecio con extrapolación de Richardson. Primera columna (trapecio con $2^k$ subintervalos) y columnas siguientes:"));
    B.push(mat(
      "R_{k,0} &= \\frac{1}{2} R_{k-1,0} + h_k \\sum_{i\\ \\text{impar}} f(a + i\\,h_k)",
      "R_{k,j} &= \\frac{4^{j} R_{k,j-1} - R_{k-1,j-1}}{4^{j} - 1}",
      "\\varepsilon_a &= \\left|\\frac{R_{k,k} - R_{k-1,k-1}}{R_{k,k}}\\right| \\cdot 100\\,\\%",
    ));
    B.push(par(`Se detiene cuando $\\varepsilon_a < \\varepsilon_s = ${n(r.tol, 10)}\\,\\%$.`));

    B.push(h("Nivel 0: un solo trapecio"));
    B.push(mat(`h_0 &= ${n(r.b)} - ${p(r.a)} = ${n(r.b - r.a, 10)}`,
      `R_{0,0} &= \\frac{h_0}{2}\\left[f(${n(r.a)}) + f(${n(r.b)})\\right] = ${n(r.R[0][0], 10)}`));

    for (const nivel of r.niveles.slice(1)) {
      const k = nivel.k;
      B.push(sub(`Nivel ${k}: ${nivel.n} subintervalos`));
      const lineas = [`h_{${k}} &= \\frac{${n(r.b - r.a)}}{${nivel.n}} = ${n(nivel.h, 10)}`];
      const nuevos = nivel.nuevos.length <= 6 ? nivel.nuevos : [...nivel.nuevos.slice(0, 3), ...nivel.nuevos.slice(-2)];
      lineas.push(`\\sum f(\\text{puntos nuevos}) &= ${nivel.nuevos.length <= 6
        ? nuevos.map((q) => p(q.fx, 8)).join(" + ")
        : `${nuevos.slice(0, 3).map((q) => p(q.fx, 8)).join(" + ")} + \\cdots + ${nuevos.slice(3).map((q) => p(q.fx, 8)).join(" + ")}`} = ${n(nivel.sumaNuevos, 10)}`);
      lineas.push(`R_{${k},0} &= \\frac{${p(r.R[k - 1][0], 10)}}{2} + ${n(nivel.h, 10)} \\cdot ${p(nivel.sumaNuevos, 10)} = ${n(r.R[k][0], 10)}`);
      for (let j = 1; j <= k; j++) {
        lineas.push(`R_{${k},${j}} &= \\frac{${4 ** j} \\cdot ${p(r.R[k][j - 1], 10)} - ${p(r.R[k - 1][j - 1], 10)}}{${4 ** j - 1}} = ${n(r.R[k][j], 10)}`);
      }
      lineas.push(`\\varepsilon_a &= \\left|\\frac{${n(r.R[k][k], 10)} - ${p(r.R[k - 1][k - 1], 10)}}{${n(r.R[k][k], 10)}}\\right| \\cdot 100\\,\\% = ${n(nivel.error, 8)}\\,\\%`);
      B.push(mat(lineas));
      if (nivel.error < r.tol) B.push(par(`Como $${n(nivel.error, 8)}\\,\\% < ${n(r.tol, 10)}\\,\\%$, se detiene.`));
    }
    if (!r.convergio) B.push(par("Se alcanzó el máximo de niveles sin cumplir la tolerancia."));
    return cierreIntegral(B, r, referencia);
  }

  function gauss(texF, r, referencia) {
    const B = [];
    B.push(h("Planteamiento"));
    B.push(mat(`I &= \\int_{${n(r.a)}}^{${n(r.b)}} ${texF}\\,dx`));
    B.push(par(`Cuadratura de Gauss-Legendre de $${r.n}$ puntos. Es exacta para polinomios de grado hasta $${2 * r.n - 1}$. `
      + "Se cambia el intervalo $[a, b]$ a $[-1, 1]$:"));
    B.push(mat(
      "x &= \\frac{b - a}{2}\\,t + \\frac{b + a}{2}, \\qquad dx = \\frac{b - a}{2}\\,dt",
      "I &\\approx \\frac{b - a}{2} \\sum_{i=1}^{n} w_i \\, f(x_i)",
    ));
    B.push(h("Paso 1. Cambio de variable"));
    B.push(mat(`x &= ${n(r.mitad, 10)}\\,t + ${p(r.centro, 10)}`, `\\frac{b - a}{2} &= ${n(r.mitad, 10)}`));
    B.push(h("Paso 2. Nodos y pesos"));
    B.push(par("Los nodos $t_i$ son las raíces del polinomio de Legendre $P_n(t)$ y los pesos son $w_i = \\dfrac{2}{(1 - t_i^2)\\,[P_n'(t_i)]^2}$."));
    B.push(mat(r.nodos.map((q, i) =>
      `t_{${i + 1}} &= ${n(q.t, 10)}, \\quad w_{${i + 1}} = ${n(q.w, 10)}, \\quad x_{${i + 1}} = ${n(q.x, 10)}, \\quad f(x_{${i + 1}}) = ${n(q.fx, 10)}`)));
    B.push(h("Paso 3. Sustituir en la fórmula"));
    const terminos = r.nodos.map((q) => `${p(q.w, 8)} \\cdot ${p(q.fx, 8)}`).join(" + ");
    B.push(mat(
      `I &\\approx ${n(r.mitad, 10)} \\left[ ${r.nodos.length <= 8 ? terminos : `${r.nodos.slice(0, 3).map((q) => `${p(q.w, 8)} \\cdot ${p(q.fx, 8)}`).join(" + ")} + \\cdots`} \\right]`,
      `&= ${n(r.mitad, 10)} \\cdot ${n(r.suma, 10)}`,
      `&= ${n(r.integral, 10)}`,
    ));
    return cierreIntegral(B, r, referencia);
  }

  return { sistema, newton, muller, bairstow, derivada, trapecio, simpson13, simpson38, romberg, gauss, aLatex, n };
})();

/*
 * Métodos numéricos (versión web). Es un porte directo de metodos_iterativos.py
 * y metodos_raices.py: mismas fórmulas, mismos criterios de parada y mismos
 * resultados.
 *
 *   Jacobi / Gauss-Seidel  -> sistemas Ax = b
 *   Newton-Raphson         -> raíces de f(x) = 0
 *   Müller                 -> raíces reales o complejas de f(x) = 0
 *   Bairstow               -> todas las raíces de un polinomio
 *
 * Usa math.js para interpretar las expresiones f(x), derivarlas y operar con
 * números complejos.
 */
/* global math */
"use strict";

const Metodos = (() => {
  // -------------------------------------------------------------------------
  // Utilidades numéricas
  // -------------------------------------------------------------------------

  const esComplejo = (v) => v !== null && typeof v === "object" && v.isComplex === true;

  /** Convierte un complejo con parte imaginaria despreciable en número real. */
  function comoReal(z, umbral = 1e-10) {
    if (esComplejo(z)) {
      return Math.abs(z.im) <= umbral * Math.max(1, Math.abs(z.re)) ? z.re : z;
    }
    return z;
  }

  const esCero = (v) => math.abs(v) === 0;

  const esFinito = (v) =>
    esComplejo(v) ? Number.isFinite(v.re) && Number.isFinite(v.im) : Number.isFinite(v);

  /** εa = |(nuevo − anterior) / nuevo| · 100. Si nuevo = 0 usa el error absoluto. */
  function errorRelativo(nuevo, anterior) {
    const diferencia = math.subtract(nuevo, anterior);
    if (esCero(nuevo)) return math.abs(diferencia) * 100;
    return math.abs(math.divide(diferencia, nuevo)) * 100;
  }

  // -------------------------------------------------------------------------
  // Sistemas lineales: Jacobi y Gauss-Seidel
  // -------------------------------------------------------------------------

  /** Dominancia diagonal estricta por filas: |a_ii| > Σ |a_ij|, j ≠ i. */
  function esDiagonalmenteDominante(A) {
    return A.every((fila, i) => {
      const resto = fila.reduce((s, v, j) => (j === i ? s : s + Math.abs(v)), 0);
      return Math.abs(fila[i]) > resto;
    });
  }

  function iterarSistema(A, b, x0, tol, maxIter, usarNuevos) {
    const n = A.length;
    let x = x0 ? x0.slice() : new Array(n).fill(0);
    const historial = [x.slice()];
    let convergio = false;
    let divergio = false;
    let k = 0;

    for (k = 1; k <= maxIter; k++) {
      const anterior = x.slice();
      const nuevo = x.slice();
      // Gauss-Seidel lee de `nuevo` (valores recién calculados); Jacobi de `anterior`.
      const fuente = usarNuevos ? nuevo : anterior;
      for (let i = 0; i < n; i++) {
        let suma = 0;
        for (let j = 0; j < n; j++) if (j !== i) suma += A[i][j] * fuente[j];
        nuevo[i] = (b[i] - suma) / A[i][i];
      }
      historial.push(nuevo.slice());
      const error = Math.max(...nuevo.map((v, i) => Math.abs(v - anterior[i])));
      x = nuevo;
      if (!Number.isFinite(error)) { divergio = true; break; }
      if (error < tol) { convergio = true; break; }
    }
    return { x, historial, iteraciones: Math.min(k, maxIter), convergio, divergio };
  }

  const jacobi = (A, b, x0, tol = 1e-6, maxIter = 100) => iterarSistema(A, b, x0, tol, maxIter, false);
  const gaussSeidel = (A, b, x0, tol = 1e-6, maxIter = 100) => iterarSistema(A, b, x0, tol, maxIter, true);

  // -------------------------------------------------------------------------
  // Expresiones f(x) escritas por el usuario
  // -------------------------------------------------------------------------

  /**
   * Acepta ** como potencia, los alias sen() y ln(), y convierte el producto
   * implícito en explícito igual que la versión Python (13x -> 13*x,
   * 2(x+1) -> 2*(x+1), (x+1)(x-2) -> (x+1)*(x-2)), para que tenga la misma
   * precedencia: x/2x = (x/2)*x. No toca nombres como log10 ni números en
   * notación científica (1e-3).
   */
  function normalizar(expresion) {
    return expresion.trim()
      .replace(/\*\*/g, "^")
      .replace(/\bsen\b/g, "sin")
      .replace(/\bln\b/g, "log")
      .replace(/(?<![A-Za-z_\d.])((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?![\d.]|[eE][+-]?\d)\s*(?=[A-Za-z(])/g, "$1*")
      .replace(/\)\s*(?=[A-Za-z\d(.])/g, ")*");
  }

  /**
   * Para x > 1, asin y acos devuelven un complejo. math.js y Python (cmath)
   * eligen ramas conjugadas; aquí se usa la de Python. (Para x < -1 coinciden.)
   */
  const fueraDeDominio = (v) => typeof v === "number" && v > 1;
  const RAMAS_PYTHON = {
    asin: (v) => (fueraDeDominio(v) ? math.conj(math.asin(v)) : math.asin(v)),
    acos: (v) => (fueraDeDominio(v) ? math.conj(math.acos(v)) : math.acos(v)),
  };

  function traducirError(exc) {
    const mensaje = String(exc && exc.message ? exc.message : exc);
    let m = mensaje.match(/Undefined symbol (\S+)/);
    if (m) return `Nombre desconocido en la expresión: «${m[1]}». Usa x como variable.`;
    m = mensaje.match(/Undefined function (\S+)/);
    if (m) return `Función desconocida en la expresión: «${m[1]}».`;
    return `No se pudo evaluar la expresión: ${mensaje}`;
  }

  function funcionDesdeNodo(nodo, textoOriginal) {
    let asigna = false;
    nodo.traverse((n) => { if (n.isAssignmentNode || n.isFunctionAssignmentNode || n.isBlockNode) asigna = true; });
    if (asigna) throw new Error("La expresión no puede contener asignaciones (=) ni punto y coma.");
    const codigo = nodo.compile();
    const f = (x) => {
      const v = codigo.evaluate({ x, ...RAMAS_PYTHON });
      if (typeof v === "number" || esComplejo(v)) return v;
      throw new Error("la expresión no produce un número.");
    };
    try {
      f(1.2345); // valor de prueba para detectar nombres desconocidos
    } catch (exc) {
      throw new Error(traducirError(exc));
    }
    f.nodo = nodo;
    f.expresion = textoOriginal;
    f.tex = nodo.toTex({ parenthesis: "auto", implicit: "hide" });
    return f;
  }

  /**
   * Convierte un texto como "exp(-x) - x" o "x^3 - 13x - 12" en una función
   * evaluable. Lanza Error con un mensaje claro si la expresión no es válida.
   */
  function crearFuncion(expresion) {
    const texto = normalizar(expresion);
    if (!texto) throw new Error("La expresión está vacía.");
    let nodo;
    try {
      nodo = math.parse(texto);
    } catch (exc) {
      throw new Error(`Expresión inválida: «${expresion.trim()}». Revisa paréntesis y operadores.`);
    }
    return funcionDesdeNodo(nodo, expresion.trim());
  }

  /** Derivada simbólica de una función creada con crearFuncion(); null si no se puede. */
  function derivadaSimbolica(f) {
    try {
      const nodo = math.derivative(f.nodo, "x");
      return funcionDesdeNodo(nodo, nodo.toString());
    } catch (exc) {
      return null;
    }
  }

  /** Diferencias centrales: f'(x) ≈ (f(x+h) − f(x−h)) / 2h. */
  function derivadaNumerica(f, h = 1e-6) {
    return (x) => {
      const paso = h * Math.max(1, math.abs(x));
      return math.divide(math.subtract(f(math.add(x, paso)), f(math.subtract(x, paso))), 2 * paso);
    };
  }

  // -------------------------------------------------------------------------
  // Newton-Raphson
  // -------------------------------------------------------------------------

  /**
   * Igual que en Python, si f(x) deja de ser real (p. ej. sqrt de un negativo)
   * la iteración continúa con números complejos.
   */
  function newtonRaphson(f, x0, df = null, tol = 1e-4, maxIter = 100) {
    if (!df) df = derivadaNumerica(f);
    let x = x0;
    const historial = [];
    let convergio = false;
    let k = 0;

    for (k = 1; k <= maxIter; k++) {
      const fx = f(x);
      const dfx = df(x);
      if (esCero(dfx)) {
        throw new Error(`f'(x) = 0 en x = ${fmt(x, 6)}: Newton-Raphson no puede continuar. Prueba con otro valor inicial.`);
      }
      const xNuevo = math.subtract(x, math.divide(fx, dfx));
      if (!esFinito(xNuevo)) {
        throw new Error("El método divergió (se obtuvo un valor no finito). Prueba con otro valor inicial.");
      }
      const error = errorRelativo(xNuevo, x);
      historial.push({ i: k - 1, x, fx, dfx, xNuevo, error });
      x = xNuevo;
      if (error < tol) { convergio = true; break; }
    }
    return { raiz: x, historial, iteraciones: Math.min(k, maxIter), convergio, fRaiz: f(x) };
  }

  // -------------------------------------------------------------------------
  // Müller
  // -------------------------------------------------------------------------

  function muller(f, x0, x1, x2, tol = 1e-4, maxIter = 100) {
    const { add, subtract, multiply, divide, sqrt, abs } = math;
    const historial = [];
    let convergio = false;
    let k = 0;
    let x3 = x2;

    for (k = 1; k <= maxIter; k++) {
      const h0 = subtract(x1, x0);
      const h1 = subtract(x2, x1);
      if (esCero(h0) || esCero(h1) || esCero(add(h0, h1))) {
        throw new Error("Los tres puntos deben ser distintos entre sí.");
      }
      const fx0 = f(x0), fx1 = f(x1), fx2 = f(x2);
      const d0 = divide(subtract(fx1, fx0), h0);
      const d1 = divide(subtract(fx2, fx1), h1);
      const a = divide(subtract(d1, d0), add(h1, h0));
      const b = add(multiply(a, h1), d1);
      const c = fx2;

      const radicando = subtract(multiply(b, b), multiply(4, multiply(a, c)));
      const discriminante = sqrt(radicando); // complejo si el radicando es negativo
      // Se elige el signo que hace el denominador de mayor magnitud (ec. 7.25)
      const mas = add(b, discriminante);
      const menos = subtract(b, discriminante);
      const denominador = abs(mas) >= abs(menos) ? mas : menos;
      if (esCero(denominador)) {
        throw new Error("Denominador cero en Müller; prueba otros puntos iniciales.");
      }

      x3 = comoReal(subtract(x2, divide(multiply(2, c), denominador)));
      if (!esFinito(x3)) {
        throw new Error("El método divergió (se obtuvo un valor no finito). Prueba otros puntos iniciales.");
      }
      const error = errorRelativo(x3, x2);

      historial.push({
        i: k, x0, x1, x2, x3, error, fx0, fx1, fx2, h0, h1, d0, d1, a, b, c,
        radicando: comoReal(radicando),
        discriminante: comoReal(discriminante),
        denominador: comoReal(denominador),
      });

      // Enfoque secuencial del libro: se descarta el punto más viejo
      x0 = x1; x1 = x2; x2 = x3;
      if (error < tol) { convergio = true; break; }
    }

    const raiz = comoReal(x3);
    return { raiz, historial, iteraciones: Math.min(k, maxIter), convergio, fRaiz: comoReal(f(raiz)) };
  }

  // -------------------------------------------------------------------------
  // Bairstow
  // -------------------------------------------------------------------------

  /** Raíces de x² − r x − s = 0:  x = (r ± √(r² + 4s)) / 2. */
  function raicesCuadratica(r, s) {
    const disc = r * r + 4 * s;
    if (disc >= 0) {
      const raiz = Math.sqrt(disc);
      return [(r + raiz) / 2, (r - raiz) / 2];
    }
    const im = Math.sqrt(-disc) / 2;
    return [comoReal(math.complex(r / 2, im)), comoReal(math.complex(r / 2, -im))];
  }

  /**
   * Divide a_0 + a_1 x + ... + a_n x^n (lista ascendente `a`) entre x² − r x − s.
   *   b_n = a_n,  b_{n-1} = a_{n-1} + r b_n,  b_i = a_i + r b_{i+1} + s b_{i+2}
   *   c_n = b_n,  c_{n-1} = b_{n-1} + r c_n,  c_i = b_i + r c_{i+1} + s c_{i+2}
   */
  function divisionSintetica(a, r, s) {
    const n = a.length - 1;
    const b = new Array(n + 1).fill(0);
    const c = new Array(n + 1).fill(0);
    b[n] = a[n];
    b[n - 1] = a[n - 1] + r * b[n];
    for (let i = n - 2; i >= 0; i--) b[i] = a[i] + r * b[i + 1] + s * b[i + 2];
    c[n] = b[n];
    c[n - 1] = b[n - 1] + r * c[n];
    for (let i = n - 2; i >= 1; i--) c[i] = b[i] + r * c[i + 1] + s * c[i + 2];
    return { b, c };
  }

  function factorCuadratico(a, r, s, tol, maxIter) {
    const historial = [];
    let convergio = false;
    let k = 0;

    for (k = 1; k <= maxIter; k++) {
      const { b, c } = divisionSintetica(a, r, s);
      // Sistema (7.36):  c2 Δr + c3 Δs = −b1 ;  c1 Δr + c2 Δs = −b0
      const det = c[2] * c[2] - c[3] * c[1];
      if (det === 0) {
        throw new Error("El sistema para Δr y Δs es singular. Prueba con otros valores iniciales de r y s.");
      }
      const deltaR = (-b[1] * c[2] + b[0] * c[3]) / det;
      const deltaS = (-b[0] * c[2] + b[1] * c[1]) / det;
      const rNuevo = r + deltaR;
      const sNuevo = s + deltaS;
      if (!Number.isFinite(rNuevo) || !Number.isFinite(sNuevo)) {
        throw new Error("El método divergió. Prueba con otros valores iniciales de r y s.");
      }
      const errorR = errorRelativo(rNuevo, r);
      const errorS = errorRelativo(sNuevo, s);
      historial.push({ i: k, r, s, deltaR, deltaS, rNuevo, sNuevo, errorR, errorS, b, c, det });
      r = rNuevo;
      s = sNuevo;
      if (errorR < tol && errorS < tol) { convergio = true; break; }
    }
    // b con los r, s finales (para reducir el polinomio con el cociente correcto)
    const { b } = divisionSintetica(a, r, s);
    return { r, s, b, historial, convergio, iteraciones: Math.min(k, maxIter) };
  }

  /**
   * Todas las raíces de un polinomio. `coeficientes` va del grado mayor al menor:
   * x² − 3x + 2 -> [1, −3, 2]. r, s: valores iniciales de x² − r x − s. tol en %.
   */
  function bairstow(coeficientes, r = -1, s = -1, tol = 1e-4, maxIter = 100) {
    const coefs = coeficientes.slice();
    while (coefs.length > 1 && coefs[0] === 0) coefs.shift();
    if (coefs.length < 2) throw new Error("El polinomio debe ser al menos de grado 1.");

    let a = coefs.slice().reverse(); // ascendente
    let n = a.length - 1;
    const raices = [];
    const factores = [];
    let convergio = true;

    while (n >= 3) {
      const f = factorCuadratico(a, r, s, tol, maxIter);
      convergio = convergio && f.convergio;
      const par = raicesCuadratica(f.r, f.s);
      raices.push(...par);
      const cociente = f.b.slice(2);
      factores.push({
        grado: n, r: f.r, s: f.s, historial: f.historial, iteraciones: f.iteraciones,
        convergio: f.convergio, raices: par, polinomio: a.slice().reverse(),
        cociente: cociente.slice().reverse(),
      });
      a = cociente;
      n = a.length - 1;
      r = f.r; // el libro reutiliza los últimos r y s para el siguiente factor
      s = f.s;
    }

    if (n === 2) {
      const rF = -a[1] / a[2];
      const sF = -a[0] / a[2];
      const par = raicesCuadratica(rF, sF);
      raices.push(...par);
      factores.push({
        grado: 2, r: rF, s: sF, historial: [], iteraciones: 0, convergio: true,
        raices: par, polinomio: a.slice().reverse(), cociente: null,
      });
    } else if (n === 1) {
      raices.push(-a[0] / a[1]);
    }
    return { raices, factores, convergio, polinomio: coefs };
  }

  // -------------------------------------------------------------------------
  // Formato
  // -------------------------------------------------------------------------

  /**
   * v con d decimales (d >= 1), redondeando igual que Python: cuando el valor
   * cae exactamente a mitad de camino (p. ej. 1/128 = 0.0078125 con 6
   * decimales) Python redondea al dígito par y toFixed() hacia arriba.
   */
  function fijo(v, d) {
    if (Math.abs(v) >= 1e21) return `${BigInt(v)}.${"0".repeat(d)}`;
    const corto = v.toFixed(d);
    const extra = Math.min(100, d + 60) - d;
    const largo = v.toFixed(d + extra);
    if (!/^50*$/.test(largo.slice(-extra))) return corto;
    const truncado = largo.slice(0, -extra);
    return "02468".includes(truncado.at(-1)) ? truncado : corto;
  }

  /** Número con decimales fijos: 1.234567 ó 1.000000 + 0.500000i. */
  function fmt(v, decimales = 6) {
    if (esComplejo(v)) {
      const signo = v.im >= 0 ? "+" : "-";
      return `${fmt(v.re, decimales)} ${signo} ${fmt(Math.abs(v.im), decimales)}i`;
    }
    if (Number.isNaN(v)) return "indefinido";
    if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
    return fijo(v, decimales);
  }

  /** [1, −3.5, 0, 2] -> "x^{3} - 3.5x^{2} + 2" (LaTeX). */
  function polinomioTex(coeficientes) {
    const n = coeficientes.length - 1;
    const partes = [];
    coeficientes.forEach((c, i) => {
      const grado = n - i;
      if (c === 0) return;
      const mag = Math.abs(c);
      const magTxt = mag === 1 && grado > 0 ? "" : String(Number(mag.toPrecision(10)));
      let termino;
      if (grado === 0) termino = magTxt;
      else if (grado === 1) termino = `${magTxt}x`;
      else termino = `${magTxt}x^{${grado}}`;
      partes.push([c < 0 ? "-" : "+", termino]);
    });
    if (!partes.length) return "0";
    let texto = (partes[0][0] === "-" ? "-" : "") + partes[0][1];
    for (const [signo, termino] of partes.slice(1)) texto += ` ${signo} ${termino}`;
    return texto;
  }

  return {
    esComplejo, comoReal, errorRelativo,
    esDiagonalmenteDominante, jacobi, gaussSeidel,
    crearFuncion, derivadaSimbolica, derivadaNumerica,
    newtonRaphson, muller, bairstow, raicesCuadratica, divisionSintetica,
    fmt, fijo, polinomioTex,
  };
})();

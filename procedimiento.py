"""
Genera el procedimiento paso a paso (en texto) de cada método, a partir del
diccionario de resultados que devuelven las funciones de metodos_iterativos
y metodos_raices. Es lo que muestra la pestaña "Procedimiento" de la interfaz.

Cada función devuelve un string listo para imprimir o pegar en un documento.
"""

from metodos_iterativos import es_diagonalmente_dominante
from metodos_raices import formatear_numero, polinomio_a_texto

MAX_ITERACIONES_DETALLADAS = 15


def _n(v, d=6):
    """Número con signo y sin ceros sobrantes: 1.5, -0.25, 3."""
    if isinstance(v, complex):
        return formatear_numero(v, d)
    v = float(v)
    if v == int(v) and abs(v) < 1e12:
        return str(int(v))
    return f"{v:.{d}f}".rstrip("0").rstrip(".")


def _p(v, d=6):
    """Número entre paréntesis si es negativo o complejo: (−2), (1 + 2i) ó 3."""
    texto = _n(v, d)
    return f"({texto})" if (texto.startswith("-") or isinstance(v, complex)) else texto


def _termino(coef, variable):
    """Texto de un término a·x para escribir ecuaciones: 4x, −y, +2z."""
    if coef == 0:
        return ""
    signo = "-" if coef < 0 else "+"
    mag = abs(coef)
    mag_txt = "" if mag == 1 else _n(mag)
    return f"{signo} {mag_txt}{variable}"


def _ecuacion(fila, bi, variables):
    partes = [_termino(c, v) for c, v in zip(fila, variables) if c != 0]
    texto = " ".join(partes).lstrip("+ ").strip()
    if texto.startswith("- "):
        texto = "-" + texto[2:]
    return f"{texto} = {_n(bi)}"


# ---------------------------------------------------------------------------
# Jacobi / Gauss-Seidel
# ---------------------------------------------------------------------------

def procedimiento_sistema(nombre, A, b, resultado, tol):
    """
    Procedimiento de Jacobi o Gauss-Seidel. `nombre` es "Jacobi" o "Gauss-Seidel".
    `resultado` es lo que devuelve jacobi() / gauss_seidel().
    """
    n = len(A)
    es_gs = nombre.lower().startswith("gauss")
    variables = [f"x{i + 1}" for i in range(n)]
    L = []

    L.append(f"MÉTODO DE {nombre.upper()}")
    L.append("=" * 60)
    L.append("")
    L.append("Sistema Ax = b:")
    for i in range(n):
        L.append("   " + _ecuacion(A[i], b[i], variables))
    L.append("")

    L.append("Paso 1. Verificar dominancia diagonal (|a_ii| > suma de |a_ij|, j ≠ i):")
    for i in range(n):
        resto = [abs(A[i][j]) for j in range(n) if j != i]
        suma = sum(resto)
        ok = abs(A[i][i]) > suma
        L.append(f"   Fila {i + 1}: |{_n(A[i][i])}| = {_n(abs(A[i][i]))}  "
                 f"{'>' if ok else '≤'}  {' + '.join(_n(v) for v in resto)} = {_n(suma)}  {'✓' if ok else '✗'}")
    if es_diagonalmente_dominante(A):
        L.append("   La matriz es diagonalmente dominante: la convergencia está garantizada.")
    else:
        L.append("   La matriz NO es diagonalmente dominante: puede converger o no. "
                 "Si diverge, reordena las ecuaciones.")
    L.append("")

    L.append("Paso 2. Despejar la incógnita de la diagonal en cada ecuación:")
    for i in range(n):
        terminos = []
        for j in range(n):
            if j != i and A[i][j] != 0:
                terminos.append(f"- {_p(A[i][j])}·{variables[j]}")
        L.append(f"   {variables[i]} = ({_n(b[i])} {' '.join(terminos)}) / {_p(A[i][i])}")
    if es_gs:
        L.append("   En Gauss-Seidel cada incógnita usa de inmediato los valores ya calculados")
        L.append("   en la misma iteración (los marcados con *).")
    else:
        L.append("   En Jacobi todas las incógnitas usan los valores de la iteración anterior.")
    L.append("")

    historial = resultado["historial"]
    x0 = historial[0]
    L.append(f"Paso 3. Iterar desde x⁽⁰⁾ = ({', '.join(_n(v) for v in x0)}) "
             f"hasta que el error máx|x⁽ᵏ⁺¹⁾ − x⁽ᵏ⁾| < {_n(tol, 10)}:")
    L.append("")

    total = len(historial) - 1
    for k in range(1, total + 1):
        if k > MAX_ITERACIONES_DETALLADAS:
            L.append(f"   ... (las iteraciones {k} a {total} siguen igual; ver la tabla) ...")
            L.append("")
            break
        x_prev = historial[k - 1]
        x_new = historial[k]
        L.append(f"   Iteración {k}:")
        for i in range(n):
            partes = []
            for j in range(n):
                if j != i and A[i][j] != 0:
                    if es_gs and j < i:
                        valor, marca = x_new[j], "*"
                    else:
                        valor, marca = x_prev[j], ""
                    partes.append(f"- {_p(A[i][j])}·{_p(valor)}{marca}")
            L.append(f"      {variables[i]} = ({_n(b[i])} {' '.join(partes)}) / {_p(A[i][i])} = {_n(x_new[i])}")
        difs = [abs(a - c) for a, c in zip(x_new, x_prev)]
        L.append(f"      Error = máx({', '.join(_n(d) for d in difs)}) = {_n(max(difs))}")
        L.append("")

    L.append("Paso 4. Resultado:")
    if resultado["convergio"]:
        L.append(f"   El error bajó de la tolerancia en la iteración {resultado['iteraciones']}. Convergió.")
    else:
        L.append(f"   Se alcanzó el máximo de {resultado['iteraciones']} iteraciones sin cumplir la tolerancia.")
    L.append("   Solución aproximada: " + ", ".join(
        f"{v} = {formatear_numero(val)}" for v, val in zip(variables, resultado["x"])))
    return "\n".join(L)


# ---------------------------------------------------------------------------
# Newton-Raphson
# ---------------------------------------------------------------------------

def procedimiento_newton(expr_f, expr_df, resultado, tol):
    """`expr_f` y `expr_df` son los textos de f(x) y f'(x); `resultado` el de newton_raphson()."""
    L = []
    L.append("MÉTODO DE NEWTON-RAPHSON")
    L.append("=" * 60)
    L.append("")
    L.append(f"f(x)  = {expr_f}")
    L.append(f"f'(x) = {expr_df}")
    L.append("")
    L.append("Fórmula:  x_(i+1) = x_i − f(x_i) / f'(x_i)")
    L.append("Error:    εa = |(x_(i+1) − x_i) / x_(i+1)| · 100 %")
    L.append(f"Se detiene cuando εa < εs = {_n(tol, 10)} %")
    L.append("")

    historial = resultado["historial"]
    x0 = historial[0]["x"]
    L.append(f"Valor inicial: x0 = {_n(x0)}")
    L.append("")
    for h in historial:
        i = h["i"]
        if i >= MAX_ITERACIONES_DETALLADAS:
            L.append(f"   ... (iteraciones {i} a {len(historial) - 1} resumidas en la tabla) ...")
            L.append("")
            break
        L.append(f"   Iteración {i}:")
        L.append(f"      f(x{i})  = f({_n(h['x'])}) = {_n(h['fx'], 8)}")
        L.append(f"      f'(x{i}) = f'({_n(h['x'])}) = {_n(h['dfx'], 8)}")
        L.append(f"      x{i + 1} = {_n(h['x'])} − ({_n(h['fx'], 8)}) / ({_n(h['dfx'], 8)}) = {_n(h['x_nuevo'], 8)}")
        L.append(f"      εa = |({_n(h['x_nuevo'], 8)} − {_n(h['x'], 8)}) / {_n(h['x_nuevo'], 8)}| · 100 = {_n(h['error'], 6)} %")
        if h["error"] < tol:
            L.append(f"      {_n(h['error'], 6)} % < {_n(tol, 10)} %  →  se detiene.")
        L.append("")

    L.append("Resultado:")
    if resultado["convergio"]:
        L.append(f"   Convergió en {resultado['iteraciones']} iteraciones.")
    else:
        L.append(f"   NO convergió en {resultado['iteraciones']} iteraciones (revisa el valor inicial).")
    L.append(f"   Raíz ≈ {formatear_numero(resultado['raiz'], 8)}")
    L.append(f"   Comprobación: f(raíz) = {formatear_numero(resultado['f_raiz'], 10)}")
    return "\n".join(L)


# ---------------------------------------------------------------------------
# Müller
# ---------------------------------------------------------------------------

def procedimiento_muller(expr_f, resultado, tol):
    L = []
    L.append("MÉTODO DE MÜLLER")
    L.append("=" * 60)
    L.append("")
    L.append(f"f(x) = {expr_f}")
    L.append("")
    L.append("Fórmulas (por tres puntos x0, x1, x2 pasa una parábola):")
    L.append("   h0 = x1 − x0,  h1 = x2 − x1")
    L.append("   δ0 = [f(x1) − f(x0)] / h0,  δ1 = [f(x2) − f(x1)] / h1")
    L.append("   a = (δ1 − δ0) / (h1 + h0),  b = a·h1 + δ1,  c = f(x2)")
    L.append("   x3 = x2 − 2c / (b ± √(b² − 4ac))   (signo que hace mayor |denominador|)")
    L.append("   εa = |(x3 − x2) / x3| · 100 %;  luego x0 ← x1, x1 ← x2, x2 ← x3")
    L.append(f"Se detiene cuando εa < εs = {_n(tol, 10)} %")
    L.append("")

    historial = resultado["historial"]
    for h in historial:
        i = h["i"]
        if i > MAX_ITERACIONES_DETALLADAS:
            L.append(f"   ... (iteraciones {i} a {len(historial)} resumidas en la tabla) ...")
            L.append("")
            break
        L.append(f"   Iteración {i}:  x0 = {_n(h['x0'])},  x1 = {_n(h['x1'])},  x2 = {_n(h['x2'])}")
        L.append(f"      f(x0) = {_n(h['fx0'])},  f(x1) = {_n(h['fx1'])},  f(x2) = {_n(h['fx2'])}")
        L.append(f"      h0 = {_n(h['x1'])} − {_p(h['x0'])} = {_n(h['h0'])}")
        L.append(f"      h1 = {_n(h['x2'])} − {_p(h['x1'])} = {_n(h['h1'])}")
        L.append(f"      δ0 = ({_n(h['fx1'])} − {_p(h['fx0'])}) / {_p(h['h0'])} = {_n(h['d0'])}")
        L.append(f"      δ1 = ({_n(h['fx2'])} − {_p(h['fx1'])}) / {_p(h['h1'])} = {_n(h['d1'])}")
        L.append(f"      a = ({_n(h['d1'])} − {_p(h['d0'])}) / ({_n(h['h1'])} + {_p(h['h0'])}) = {_n(h['a'])}")
        L.append(f"      b = {_p(h['a'])}·{_p(h['h1'])} + {_p(h['d1'])} = {_n(h['b'])}")
        L.append(f"      c = f(x2) = {_n(h['c'])}")
        disc2 = h["b"] * h["b"] - 4 * h["a"] * h["c"]
        L.append(f"      √(b² − 4ac) = √({_n(h['b'])}² − 4·{_p(h['a'])}·{_p(h['c'])}) = √({_n(disc2)}) = {_n(h['discriminante'])}")
        L.append(f"      Denominador de mayor magnitud: {_n(h['denominador'])}")
        L.append(f"      x3 = {_n(h['x2'])} − 2·{_p(h['c'])} / {_p(h['denominador'])} = {_n(h['x3'])}")
        L.append(f"      εa = |({_n(h['x3'])} − {_p(h['x2'])}) / {_p(h['x3'])}| · 100 = {_n(h['error'])} %")
        if h["error"] < tol:
            L.append(f"      {_n(h['error'])} % < {_n(tol, 10)} %  →  se detiene.")
        L.append("")

    L.append("Resultado:")
    if resultado["convergio"]:
        L.append(f"   Convergió en {resultado['iteraciones']} iteraciones.")
    else:
        L.append(f"   NO convergió en {resultado['iteraciones']} iteraciones.")
    tipo = "compleja" if isinstance(resultado["raiz"], complex) else "real"
    L.append(f"   Raíz ({tipo}) ≈ {formatear_numero(resultado['raiz'], 8)}")
    if isinstance(resultado["raiz"], complex):
        L.append(f"   (su conjugada {formatear_numero(resultado['raiz'].conjugate(), 8)} también es raíz)")
    L.append(f"   Comprobación: f(raíz) = {formatear_numero(resultado['f_raiz'], 10)}")
    return "\n".join(L)


# ---------------------------------------------------------------------------
# Bairstow
# ---------------------------------------------------------------------------

def _lista_b(a, b, r, s, letra_fuente="a"):
    """Líneas con el cálculo de cada b_i (o c_i) con los números sustituidos."""
    n = len(a) - 1
    L = []
    L.append(f"      b{n} = {letra_fuente}{n} = {_n(b[n])}")
    L.append(f"      b{n - 1} = {letra_fuente}{n - 1} + r·b{n} = {_n(a[n - 1])} + {_p(r)}·{_p(b[n])} = {_n(b[n - 1])}")
    for i in range(n - 2, -1, -1):
        L.append(f"      b{i} = {letra_fuente}{i} + r·b{i + 1} + s·b{i + 2} = "
                 f"{_n(a[i])} + {_p(r)}·{_p(b[i + 1])} + {_p(s)}·{_p(b[i + 2])} = {_n(b[i])}")
    return L


def _lista_c(b, c, r, s):
    n = len(b) - 1
    L = []
    L.append(f"      c{n} = b{n} = {_n(c[n])}")
    L.append(f"      c{n - 1} = b{n - 1} + r·c{n} = {_n(b[n - 1])} + {_p(r)}·{_p(c[n])} = {_n(c[n - 1])}")
    for i in range(n - 2, 0, -1):
        L.append(f"      c{i} = b{i} + r·c{i + 1} + s·c{i + 2} = "
                 f"{_n(b[i])} + {_p(r)}·{_p(c[i + 1])} + {_p(s)}·{_p(c[i + 2])} = {_n(c[i])}")
    return L


def procedimiento_bairstow(resultado, tol):
    L = []
    L.append("MÉTODO DE BAIRSTOW")
    L.append("=" * 60)
    L.append("")
    L.append(f"f(x) = {polinomio_a_texto(resultado['polinomio'])}")
    L.append("")
    L.append("Fórmulas (división entre x² − r·x − s):")
    L.append("   b_n = a_n,  b_(n−1) = a_(n−1) + r·b_n,  b_i = a_i + r·b_(i+1) + s·b_(i+2)")
    L.append("   c_n = b_n,  c_(n−1) = b_(n−1) + r·c_n,  c_i = b_i + r·c_(i+1) + s·c_(i+2)")
    L.append("   Sistema:  c2·Δr + c3·Δs = −b1      c1·Δr + c2·Δs = −b0")
    L.append("   r ← r + Δr,  s ← s + Δs;   εr = |Δr/r|·100 %,  εs = |Δs/s|·100 %")
    L.append("   Raíces del factor:  x = (r ± √(r² + 4s)) / 2")
    L.append(f"Se detiene cuando εr y εs < {_n(tol, 10)} %")
    L.append("")

    for num, factor in enumerate(resultado["factores"], 1):
        coefs = factor["polinomio"]
        a = list(reversed(coefs))
        n = len(a) - 1
        L.append("-" * 60)
        L.append(f"FACTOR {num}: polinomio de grado {n}:  {polinomio_a_texto(coefs)}")
        L.append("   Coeficientes: " + ", ".join(f"a{i} = {_n(a[i])}" for i in range(n, -1, -1)))
        L.append("")

        if not factor["historial"]:
            if n == 2:
                L.append("   Es de grado 2: se resuelve directamente con la fórmula cuadrática.")
                L.append(f"   Se escribe como x² − r·x − s con r = −a1/a2 = {_n(factor['r'])}, "
                         f"s = −a0/a2 = {_n(factor['s'])}")
        else:
            for h in factor["historial"]:
                i = h["i"]
                if i > MAX_ITERACIONES_DETALLADAS:
                    L.append(f"   ... (iteraciones {i} a {factor['iteraciones']} resumidas en la tabla) ...")
                    L.append("")
                    break
                r, s, b, c = h["r"], h["s"], h["b"], h["c"]
                L.append(f"   Iteración {i}:  r = {_n(r)},  s = {_n(s)}")
                L.append("      Coeficientes b (división sintética):")
                L.extend(_lista_b(a, b, r, s))
                L.append("      Coeficientes c:")
                L.extend(_lista_c(b, c, r, s))
                L.append("      Sistema para Δr y Δs:")
                L.append(f"         {_p(c[2])}·Δr + {_p(c[3])}·Δs = {_n(-b[1])}")
                L.append(f"         {_p(c[1])}·Δr + {_p(c[2])}·Δs = {_n(-b[0])}")
                det = c[2] * c[2] - c[3] * c[1]
                L.append(f"         Determinante = {_p(c[2])}² − {_p(c[3])}·{_p(c[1])} = {_n(det)}")
                L.append(f"         Δr = ({_p(-b[1])}·{_p(c[2])} − {_p(-b[0])}·{_p(c[3])}) / {_p(det)} = {_n(h['delta_r'])}")
                L.append(f"         Δs = ({_p(c[2])}·{_p(-b[0])} − {_p(c[1])}·{_p(-b[1])}) / {_p(det)} = {_n(h['delta_s'])}")
                L.append(f"      r = {_n(r)} + {_p(h['delta_r'])} = {_n(h['r_nuevo'])}")
                L.append(f"      s = {_n(s)} + {_p(h['delta_s'])} = {_n(h['s_nuevo'])}")
                L.append(f"      εr = |{_n(h['delta_r'])} / {_p(h['r_nuevo'])}|·100 = {_n(h['error_r'], 4)} %   "
                         f"εs = |{_n(h['delta_s'])} / {_p(h['s_nuevo'])}|·100 = {_n(h['error_s'], 4)} %")
                if h["error_r"] < tol and h["error_s"] < tol:
                    L.append(f"      Ambos errores < {_n(tol, 10)} %  →  el factor convergió.")
                L.append("")
            if not factor["convergio"]:
                L.append(f"   ⚠ Se alcanzó el máximo de {factor['iteraciones']} iteraciones sin converger.")
                L.append("")

        r, s = factor["r"], factor["s"]
        x1, x2 = factor["raices"]
        disc = r * r + 4 * s
        L.append(f"   Factor cuadrático: x² − {_p(r)}·x − {_p(s)}")
        L.append(f"   Raíces: x = ({_n(r)} ± √({_n(r)}² + 4·{_p(s)})) / 2 = ({_n(r)} ± √({_n(disc)})) / 2")
        L.append(f"      x = {formatear_numero(x1)}    x = {formatear_numero(x2)}")
        if n >= 3:
            # cociente: b_n ... b_2 (coeficientes descendentes)
            from metodos_raices import _division_sintetica
            b_final, _ = _division_sintetica(a, r, s)
            cociente = list(reversed(b_final[2:]))
            L.append(f"   Polinomio reducido (cociente b{n}…b2): {polinomio_a_texto(cociente)}")
            if len(cociente) == 2:
                L.append(f"      Es de grado 1: x = −({_n(cociente[1])}) / {_p(cociente[0])} = "
                         f"{_n(-cociente[1] / cociente[0])}")
        L.append("")

    L.append("=" * 60)
    L.append("RAÍCES DEL POLINOMIO:")
    for i, raiz in enumerate(resultado["raices"], 1):
        L.append(f"   x{i} = {formatear_numero(raiz)}")
    if not resultado["convergio"]:
        L.append("   ⚠ Algún factor no convergió: prueba otros valores iniciales de r y s.")
    return "\n".join(L)

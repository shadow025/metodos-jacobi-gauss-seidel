"""
Métodos numéricos para encontrar raíces de ecuaciones y polinomios.

Implementa, siguiendo a Chapra & Canale (Métodos numéricos para ingenieros):

    Newton-Raphson (sección 6.2):
        x_{i+1} = x_i - f(x_i) / f'(x_i)

    Müller (sección 7.2):
        Ajusta una parábola por tres puntos (x0, x1, x2) y toma como nueva
        aproximación la raíz de la parábola más cercana a x2. Permite
        encontrar raíces complejas.

    Bairstow (sección 7.5):
        Divide el polinomio entre el factor cuadrático x^2 - r x - s y
        corrige r y s (Δr, Δs) hasta que el residuo sea ~0. De cada factor
        se obtienen dos raíces (reales o complejas) y el polinomio se
        reduce hasta agotar todas sus raíces.

En los tres métodos la tolerancia `tol` se expresa como error relativo
porcentual aproximado (εs, en %), igual que en el libro:
    εa = |(x_nuevo - x_anterior) / x_nuevo| * 100
"""

import cmath
import math

# ---------------------------------------------------------------------------
# Utilidades: evaluación de expresiones f(x) escritas por el usuario
# ---------------------------------------------------------------------------

_NOMBRES_FUNCIONES = [
    "sin", "cos", "tan", "asin", "acos", "atan",
    "sinh", "cosh", "tanh", "exp", "log", "log10", "sqrt",
]


def _funcion_real_o_compleja(nombre):
    """Devuelve una función que usa `math` para reales y `cmath` para complejos."""
    f_real = getattr(math, nombre)
    f_compleja = getattr(cmath, nombre)

    def g(v):
        if isinstance(v, complex):
            return f_compleja(v)
        try:
            return f_real(v)
        except ValueError:  # p. ej. sqrt(-4) o log(-1): pasar a complejos
            return f_compleja(v)

    return g


_ENTORNO = {nombre: _funcion_real_o_compleja(nombre) for nombre in _NOMBRES_FUNCIONES}
_ENTORNO.update({
    "sen": _ENTORNO["sin"],      # alias en español
    "ln": _ENTORNO["log"],
    "abs": abs,
    "pi": math.pi,
    "e": math.e,
    "E": math.e,
})


def crear_funcion(expresion: str):
    """
    Convierte un texto como "exp(-x) - x" o "x^3 - 13x - 12" en una función
    f(x) evaluable. Acepta ^ como potencia y funciones sin, cos, exp, log, sqrt...

    Lanza ValueError con un mensaje claro si la expresión no es válida.
    """
    texto = expresion.strip()
    if not texto:
        raise ValueError("La expresión f(x) está vacía.")

    texto = texto.replace("^", "**")
    # Permitir productos implícitos sencillos: 13x -> 13*x, 2(x+1) -> 2*(x+1)
    import re
    texto = re.sub(r"(\d)\s*([a-zA-Z(])", r"\1*\2", texto)
    texto = re.sub(r"(\))\s*([a-zA-Z(\d])", r"\1*\2", texto)

    try:
        codigo = compile(texto, "<f(x)>", "eval")
    except SyntaxError as exc:
        raise ValueError(f"Expresión inválida: {expresion!r}") from exc

    def f(x):
        entorno = dict(_ENTORNO)
        entorno["x"] = x
        return eval(codigo, {"__builtins__": {}}, entorno)

    try:  # validar con un valor de prueba para detectar nombres desconocidos
        f(1.2345)
    except NameError as exc:
        raise ValueError(f"Nombre desconocido en la expresión: {exc}") from exc
    except ZeroDivisionError:
        pass
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"No se pudo evaluar la expresión: {exc}") from exc

    f.expresion = expresion.strip()
    return f


def derivada_numerica(f, h=1e-6):
    """Derivada por diferencias centrales: f'(x) ≈ (f(x+h) - f(x-h)) / 2h."""

    def df(x):
        paso = h * max(1.0, abs(x))
        return (f(x + paso) - f(x - paso)) / (2 * paso)

    return df


def derivada_simbolica(expresion: str):
    """
    Intenta derivar simbólicamente con sympy. Devuelve (df, texto_derivada)
    o (None, None) si sympy no está instalado o la expresión no se pudo derivar.
    """
    try:
        import sympy
    except ImportError:
        return None, None
    try:
        x = sympy.Symbol("x")
        texto = expresion.replace("^", "**")
        expr = sympy.sympify(texto, locals={"x": x, "sen": sympy.sin, "ln": sympy.log})
        dexpr = sympy.diff(expr, x)
        texto_derivada = str(dexpr)
        return crear_funcion(texto_derivada), texto_derivada
    except Exception:  # noqa: BLE001
        return None, None


def error_relativo_porcentual(nuevo, anterior):
    """εa = |(nuevo - anterior) / nuevo| * 100. Si nuevo = 0 usa el error absoluto."""
    if nuevo == 0:
        return abs(nuevo - anterior) * 100
    return abs((nuevo - anterior) / nuevo) * 100


# ---------------------------------------------------------------------------
# Newton-Raphson
# ---------------------------------------------------------------------------

def newton_raphson(f, x0, df=None, tol=1e-4, max_iter=100):
    """
    Resuelve f(x) = 0 con Newton-Raphson a partir de x0.

    df  -> derivada f'(x). Si es None se usa derivada numérica.
    tol -> error relativo porcentual εs (%) para detener la iteración.

    Retorna un diccionario con:
        raiz        -> última aproximación
        historial   -> lista de dicts: i, x, fx, dfx, x_nuevo, error (%)
        iteraciones -> número de iteraciones realizadas
        convergio   -> True si el error bajó de la tolerancia
    """
    if df is None:
        df = derivada_numerica(f)

    x = float(x0)
    historial = []
    convergio = False
    k = 0

    for k in range(1, max_iter + 1):
        fx = f(x)
        dfx = df(x)
        if dfx == 0:
            raise ZeroDivisionError(
                f"f'(x) = 0 en x = {x:.6g}: Newton-Raphson no puede continuar. "
                "Prueba con otro valor inicial."
            )
        x_nuevo = x - fx / dfx
        error = error_relativo_porcentual(x_nuevo, x)
        historial.append({"i": k - 1, "x": x, "fx": fx, "dfx": dfx,
                          "x_nuevo": x_nuevo, "error": error})
        x = x_nuevo
        if error < tol:
            convergio = True
            break

    return {"raiz": x, "historial": historial, "iteraciones": k, "convergio": convergio,
            "f_raiz": f(x)}


# ---------------------------------------------------------------------------
# Müller
# ---------------------------------------------------------------------------

def _como_real_si_es_posible(z, umbral=1e-10):
    """Convierte un complejo con parte imaginaria despreciable en float."""
    if isinstance(z, complex):
        if abs(z.imag) <= umbral * max(1.0, abs(z.real)):
            return z.real
        return z
    return z


def muller(f, x0, x1, x2, tol=1e-4, max_iter=100):
    """
    Resuelve f(x) = 0 con el método de Müller a partir de tres puntos.

    Retorna un diccionario con:
        raiz        -> aproximación final (float, o complex si la raíz es compleja)
        historial   -> lista de dicts: i, x0, x1, x2, x3, error (%)
        iteraciones, convergio, f_raiz
    """
    x0, x1, x2 = float(x0), float(x1), float(x2)
    historial = []
    convergio = False
    k = 0
    x3 = x2

    for k in range(1, max_iter + 1):
        h0 = x1 - x0
        h1 = x2 - x1
        if h0 == 0 or h1 == 0 or h0 + h1 == 0:
            raise ZeroDivisionError("Los tres puntos iniciales deben ser distintos entre sí.")
        d0 = (f(x1) - f(x0)) / h0
        d1 = (f(x2) - f(x1)) / h1
        a = (d1 - d0) / (h1 + h0)
        b = a * h1 + d1
        c = f(x2)

        discriminante = cmath.sqrt(b * b - 4 * a * c)
        # Se elige el signo que hace el denominador de mayor magnitud (ec. 7.25)
        if abs(b + discriminante) >= abs(b - discriminante):
            denominador = b + discriminante
        else:
            denominador = b - discriminante
        if denominador == 0:
            raise ZeroDivisionError("Denominador cero en Müller; prueba otros puntos iniciales.")

        x3 = x2 - 2 * c / denominador
        x3 = _como_real_si_es_posible(x3)
        error = error_relativo_porcentual(x3, x2)

        historial.append({"i": k, "x0": x0, "x1": x1, "x2": x2, "x3": x3, "error": error})

        # Enfoque secuencial del libro: se descarta el punto más viejo
        x0, x1, x2 = x1, x2, x3

        if error < tol:
            convergio = True
            break

    raiz = _como_real_si_es_posible(x3)
    return {"raiz": raiz, "historial": historial, "iteraciones": k, "convergio": convergio,
            "f_raiz": _como_real_si_es_posible(f(raiz))}


# ---------------------------------------------------------------------------
# Bairstow
# ---------------------------------------------------------------------------

def evaluar_polinomio(coeficientes, x):
    """Evalúa el polinomio dado por coeficientes [a_n, ..., a_1, a_0] (Horner)."""
    resultado = 0
    for c in coeficientes:
        resultado = resultado * x + c
    return resultado


def raices_cuadratica(r, s):
    """Raíces de x^2 - r x - s = 0:  x = (r ± sqrt(r^2 + 4 s)) / 2."""
    disc = cmath.sqrt(r * r + 4 * s)
    x1 = _como_real_si_es_posible((r + disc) / 2)
    x2 = _como_real_si_es_posible((r - disc) / 2)
    return x1, x2


def _division_sintetica(a, r, s):
    """
    Divide el polinomio a_0 + a_1 x + ... + a_n x^n (lista ascendente `a`)
    entre x^2 - r x - s.  Devuelve (b, c) con las recurrencias del libro:

        b_n = a_n,  b_{n-1} = a_{n-1} + r b_n,
        b_i = a_i + r b_{i+1} + s b_{i+2}            (i = n-2 ... 0)

        c_n = b_n,  c_{n-1} = b_{n-1} + r c_n,
        c_i = b_i + r c_{i+1} + s c_{i+2}            (i = n-2 ... 1)
    """
    n = len(a) - 1
    b = [0.0] * (n + 1)
    c = [0.0] * (n + 1)

    b[n] = a[n]
    b[n - 1] = a[n - 1] + r * b[n]
    for i in range(n - 2, -1, -1):
        b[i] = a[i] + r * b[i + 1] + s * b[i + 2]

    c[n] = b[n]
    c[n - 1] = b[n - 1] + r * c[n]
    for i in range(n - 2, 0, -1):
        c[i] = b[i] + r * c[i + 1] + s * c[i + 2]

    return b, c


def _factor_cuadratico(a, r, s, tol, max_iter):
    """
    Itera Bairstow sobre un polinomio (coeficientes ascendentes `a`, grado >= 3)
    hasta encontrar un factor x^2 - r x - s. Devuelve (r, s, b, historial, convergio, k).
    """
    historial = []
    convergio = False
    k = 0
    b = c = None

    for k in range(1, max_iter + 1):
        b, c = _division_sintetica(a, r, s)

        # Sistema (7.36):  c2 Δr + c3 Δs = -b1
        #                  c1 Δr + c2 Δs = -b0
        det = c[2] * c[2] - c[3] * c[1]
        if det == 0:
            raise ZeroDivisionError(
                "El sistema para Δr y Δs es singular. Prueba con otros valores iniciales de r y s."
            )
        delta_r = (-b[1] * c[2] + b[0] * c[3]) / det
        delta_s = (-b[0] * c[2] + b[1] * c[1]) / det

        r_nuevo = r + delta_r
        s_nuevo = s + delta_s
        error_r = error_relativo_porcentual(r_nuevo, r)
        error_s = error_relativo_porcentual(s_nuevo, s)

        historial.append({
            "i": k, "r": r, "s": s, "delta_r": delta_r, "delta_s": delta_s,
            "r_nuevo": r_nuevo, "s_nuevo": s_nuevo,
            "error_r": error_r, "error_s": error_s,
            "b": list(b), "c": list(c),
        })

        r, s = r_nuevo, s_nuevo

        if error_r < tol and error_s < tol:
            convergio = True
            break

    # b con los r, s finales (para reducir el polinomio con el cociente correcto)
    b, _ = _division_sintetica(a, r, s)
    return r, s, b, historial, convergio, k


def bairstow(coeficientes, r=-1.0, s=-1.0, tol=1e-4, max_iter=100):
    """
    Encuentra TODAS las raíces (reales y complejas) de un polinomio con Bairstow.

    coeficientes -> lista [a_n, ..., a_1, a_0] del grado mayor al menor.
                    Ej: x^5 - 3.5x^4 + 2.75x^3 + 2.125x^2 - 3.875x + 1.25
                        -> [1, -3.5, 2.75, 2.125, -3.875, 1.25]
    r, s         -> valores iniciales del factor cuadrático x^2 - r x - s
    tol          -> εs en % (se exige |Δr/r| y |Δs/s| por debajo de tol)

    Retorna un diccionario con:
        raices    -> lista con todas las raíces (float o complex)
        factores  -> lista de dicts, uno por factor cuadrático encontrado:
                     grado, r, s, historial, iteraciones, convergio, raices
        convergio -> True si todos los factores convergieron
    """
    coefs = [float(c) for c in coeficientes]
    # quitar ceros a la izquierda (grado real del polinomio)
    while len(coefs) > 1 and coefs[0] == 0:
        coefs.pop(0)
    if len(coefs) < 2:
        raise ValueError("El polinomio debe ser al menos de grado 1.")

    a = list(reversed(coefs))  # ascendente: a[0] + a[1] x + ... + a[n] x^n
    n = len(a) - 1

    raices = []
    factores = []
    convergio_total = True
    r_actual, s_actual = float(r), float(s)

    while n >= 3:
        r_f, s_f, b, historial, convergio, k = _factor_cuadratico(a, r_actual, s_actual, tol, max_iter)
        convergio_total = convergio_total and convergio
        x1, x2 = raices_cuadratica(r_f, s_f)
        raices.extend([x1, x2])
        factores.append({
            "grado": n, "r": r_f, "s": s_f, "historial": historial,
            "iteraciones": k, "convergio": convergio, "raices": (x1, x2),
            "polinomio": list(reversed(a)),
        })
        # Polinomio reducido: el cociente b_2 ... b_n
        a = b[2:]
        n = len(a) - 1
        # el libro reutiliza los últimos r y s como valores iniciales del siguiente factor
        r_actual, s_actual = r_f, s_f

    if n == 2:
        # a[0] + a[1] x + a[2] x^2 = 0  ->  x^2 - r x - s con r = -a1/a2, s = -a0/a2
        r_f = -a[1] / a[2]
        s_f = -a[0] / a[2]
        x1, x2 = raices_cuadratica(r_f, s_f)
        raices.extend([x1, x2])
        factores.append({"grado": 2, "r": r_f, "s": s_f, "historial": [], "iteraciones": 0,
                         "convergio": True, "raices": (x1, x2), "polinomio": list(reversed(a))})
    elif n == 1:
        raices.append(-a[0] / a[1])

    return {"raices": raices, "factores": factores, "convergio": convergio_total,
            "polinomio": coefs}


# ---------------------------------------------------------------------------
# Formato
# ---------------------------------------------------------------------------

def formatear_numero(v, decimales=6):
    """Formatea float o complex de forma legible: 1.234567 ó 1.000000 + 0.500000i."""
    if isinstance(v, complex):
        signo = "+" if v.imag >= 0 else "-"
        return f"{v.real:.{decimales}f} {signo} {abs(v.imag):.{decimales}f}i"
    return f"{v:.{decimales}f}"


def polinomio_a_texto(coeficientes):
    """[1, -3.5, 0, 2] -> 'x^3 - 3.5x^2 + 2'."""
    n = len(coeficientes) - 1
    partes = []
    for i, c in enumerate(coeficientes):
        grado = n - i
        if c == 0:
            continue
        signo = "-" if c < 0 else "+"
        mag = abs(c)
        mag_txt = "" if (mag == 1 and grado > 0) else f"{mag:g}"
        if grado == 0:
            termino = f"{mag:g}"
        elif grado == 1:
            termino = f"{mag_txt}x"
        else:
            termino = f"{mag_txt}x^{grado}"
        partes.append((signo, termino))
    if not partes:
        return "0"
    texto = ("-" if partes[0][0] == "-" else "") + partes[0][1]
    for signo, termino in partes[1:]:
        texto += f" {signo} {termino}"
    return texto

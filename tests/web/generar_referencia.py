"""
Genera tests/web/referencia.json: los resultados de la versión Python (la de
referencia) sobre cientos de casos fijos y aleatorios (con semilla fija).

tests/web/comparar.js ejecuta los mismos casos con la versión web
(docs/metodos.js) y compara número por número.

Uso (desde la raíz del proyecto):
    python tests/web/generar_referencia.py
"""

import json
import math
import os
import random
import sys
import warnings

import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)

from metodos_iterativos import es_diagonalmente_dominante, gauss_seidel, jacobi  # noqa: E402
from metodos_raices import (  # noqa: E402
    bairstow,
    crear_funcion,
    derivada_simbolica,
    formatear_numero,
    muller,
    newton_raphson,
    polinomio_a_texto,
)
from procedimiento import _n, _p  # noqa: E402

warnings.filterwarnings("ignore")
np.seterr(all="ignore")
rnd = random.Random(20261111)


def enc(v):
    """Convierte resultados (numpy, complejos, inf/nan) a algo serializable en JSON."""
    if isinstance(v, dict):
        return {k: enc(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, np.ndarray)):
        return [enc(x) for x in v]
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, complex):
        return {"re": enc(v.real), "im": enc(v.imag)}
    if isinstance(v, (int, np.integer)):
        return int(v)
    if isinstance(v, (float, np.floating)):
        v = float(v)
        if math.isnan(v):
            return "nan"
        if math.isinf(v):
            return "inf" if v > 0 else "-inf"
        return v
    if v is None or isinstance(v, str):
        return v
    raise TypeError(f"el resultado no es un número: {type(v).__name__}")


def intentar(fn):
    try:
        return {"ok": enc(fn())}
    except Exception as exc:  # noqa: BLE001
        return {"error": type(exc).__name__, "mensaje": str(exc)}


# ---------------------------------------------------------------------------
# Expresiones
# ---------------------------------------------------------------------------

EXPRESIONES = [
    "exp(-x) - x", "x^3 - 13x - 12", "sin(x) - x/2", "x**2 - 2", "x^2 - 2",
    "sen(x) + ln(x)", "2(x+1)", "(x+1)(x-2)", "3x^2 - 2x + 1", "-x^2", "2^-x",
    "x^2^3", "log10(x) + 1", "log(x)", "sqrt(x) - 1", "abs(x) - 1", "pi*x - e",
    "e^x - 3x", "E*x", "cos(x) - x", "tan(x) - x", "x*exp(x) - 1", "1/x - 2",
    "1/2x", "1/2*x", "x/2x", "2x/3", "4x^3 - 2x^2 + x - 7", "x^4 - 1",
    "asin(x/4)", "acos(x/4)", "atan(x)", "sinh(x) - 1", "cosh(x) - 2", "tanh(x)",
    "asin(x)", "acos(x)", "x^0.5", "(-x)^0.5", "x^(1/3)", "2 x", "x 2",
    "sin(x)^2 + cos(x)^2", "sin x", "exp(x)/(1+x^2)", "x - cos(x)", "x^3 + x + 1",
    "x^2 + 1", "(x - 1)^2", "x^3", "1e3x", "2.5e-1*x", "x%2", "x//2", "x!",
    "", "   ", "x +", "y + 1", "foo(x)", "x(x+1)", "(x+1", "2*", "x = 3", "x; 2",
    "sin", "x^", "abs(x - 3) - 1", "ln(x^2 + 1) - 1", "sqrt(x^2 + 1) - 2",
    "exp(x) - 1000", "10^x - 5", "x^2x", "2x^2x", "3(x)2", "(x)(x)", "2sin(x)cos(x)", "x/2(x+1)", "1/2(x+1)", "2^3x", "-2x^2", "x^-2x", "1.5x - .5x", "log10(10x)", "2pi", "2e", "2e^x", "4x/2x/3x", "1e-3 + x", "1E2*x", "asin(2x)", "acos(-2x)", "asin(x)*acos(x)", "x^5 - 3.5x^4 + 2.75x^3 + 2.125x^2 - 3.875x + 1.25",
]
PUNTOS = [0.5, 1.2345, 2.0, -1.5, 3.7, 0.0, 1 + 2j, -0.5 + 0.3j]


def casos_expresiones():
    casos = []
    for expr in EXPRESIONES:
        caso = {"expr": expr}
        try:
            f = crear_funcion(expr)
        except Exception as exc:  # noqa: BLE001
            caso["error"] = type(exc).__name__
            casos.append(caso)
            continue
        caso["puntos"] = enc(PUNTOS)
        caso["valores"] = [intentar(lambda p=p: f(p)) for p in PUNTOS]
        casos.append(caso)
    return casos


# ---------------------------------------------------------------------------
# Sistemas lineales
# ---------------------------------------------------------------------------

def casos_sistemas():
    casos = []

    def agregar(A, b, x0, tol, max_iter):
        casos.append({
            "A": A, "b": b, "x0": x0, "tol": tol, "max_iter": max_iter,
            "dominante": bool(es_diagonalmente_dominante(np.array(A, dtype=float))),
            "jacobi": enc(jacobi(A, b, x0=x0, tol=tol, max_iter=max_iter)),
            "gs": enc(gauss_seidel(A, b, x0=x0, tol=tol, max_iter=max_iter)),
        })

    agregar([[20, 1, -1], [3, 20, 1], [2, -3, 20]], [17, -18, 25], None, 1e-6, 100)
    agregar([[4, -1, 0], [-1, 4, -1], [0, -1, 4]], [15, 10, 10], None, 1e-6, 100)
    agregar([[1, 2], [3, 1]], [3, 4], None, 1e-6, 50)          # diverge
    agregar([[2, 1], [1, 2]], [3, 3], [1, 1], 1e-6, 100)       # x0 ya es la solución
    agregar([[5]], [10], None, 1e-6, 100)                      # 1x1
    agregar([[2, 2], [2, 2]], [4, 4], None, 1e-6, 30)          # borde de dominancia (igualdad)

    for _ in range(450):
        n = rnd.randint(2, 7)
        entero = rnd.random() < 0.5
        A = [[(rnd.randint(-9, 9) if entero else round(rnd.uniform(-9, 9), 3)) for _ in range(n)] for _ in range(n)]
        tipo = rnd.random()
        for i in range(n):
            resto = sum(abs(A[i][j]) for j in range(n) if j != i)
            if tipo < 0.6:      # estrictamente dominante
                A[i][i] = (resto + rnd.uniform(0.5, 10)) * rnd.choice([-1, 1])
                if entero:
                    A[i][i] = float(math.ceil(abs(A[i][i]))) * (1 if A[i][i] > 0 else -1)
            elif A[i][i] == 0:  # cualquier matriz, pero sin ceros en la diagonal
                A[i][i] = rnd.choice([-1, 1]) * rnd.randint(1, 9)
        b = [rnd.randint(-20, 20) if entero else round(rnd.uniform(-20, 20), 3) for _ in range(n)]
        x0 = None if rnd.random() < 0.5 else [round(rnd.uniform(-5, 5), 2) for _ in range(n)]
        tol = rnd.choice([1e-2, 1e-4, 1e-6, 1e-10])
        max_iter = rnd.choice([1, 3, 25, 100, 400])
        agregar(A, b, x0, tol, max_iter)
    return casos


# ---------------------------------------------------------------------------
# Newton-Raphson
# ---------------------------------------------------------------------------

NEWTON = [
    ("exp(-x) - x", [0, 1, -2, 5]),
    ("x^3 - 13x - 12", [4.5, 0, -2, 10, -10, 2.1]),
    ("sin(x) - x/2", [1, 2, 3, -2, 10]),
    ("x^2 - 2", [1, -1, 100, 0.001, 0]),
    ("cos(x) - x", [0, 1, 5, -3]),
    ("x*exp(x) - 1", [0, 1, 3, -0.5]),
    ("ln(x) - 1", [1, 2, 5, 0.1]),
    ("log10(x) + 1", [0.5, 0.05, 1]),
    ("sqrt(x) - 2", [1, 3, 9]),
    ("x^3", [1, -2, 0.1]),
    ("(x - 1)^2", [0, 3]),
    ("x^3 - 2x + 2", [0, 1, -2]),       # ciclo clásico 0 -> 1 -> 0
    ("atan(x)", [0.5, 1, 1.5, 3]),      # diverge para |x0| grande
    ("x^2 + 1", [1, 0.5, 0]),           # sin raíz real
    ("tan(x) - x", [4.4, 4.6, 1]),
    ("e^x - 3x", [0, 2, 1]),
    ("x^5 - 3.5x^4 + 2.75x^3 + 2.125x^2 - 3.875x + 1.25", [0, -2, 3, 1.4, 0.6]),
    ("4x^3 - 2x^2 + x - 7", [1, 0, -5]),
    ("1/x - 2", [0.1, 0.4, 1, 2]),
    ("sinh(x) - 1", [0, 2, -3]),
    ("abs(x) - 1", [0.5, -3, 2]),
    ("exp(x) - 1000", [0, 5, 20, 800]),
    ("x - cos(x)", [0.7, 100]),
    ("sen(x)", [3, 1.5707963267948966, 6]),
    ("10^x - 5", [0, 1, 3]),
    ("sqrt(x^2 + 1) - 2", [1, -1, 0, 4]),
    ("x^(1/3)", [1, 0.5]),
    ("sqrt(x) - 2", [25, 30, 100]),     # la iteración pasa por números complejos
    ("ln(x) - 1", [10, 20]),
    ("x^2 + 1", [2, 3]),
    ("x/2x - 3", [1, 5]),               # precedencia del producto implícito
    ("(x+1)(x-2)", [0, 3, 0.5]),
    ("2(x-1)^2 - 3x", [0, 5]),
]
DERIVADAS_EXPLICITAS = {
    "exp(-x) - x": "-exp(-x) - 1",
    "x^3 - 13x - 12": "3x^2 - 13",
    "x^2 - 2": "2x",
    "cos(x) - x": "-sin(x) - 1",
    "sen(x)": "cos(x)",
}


def casos_newton():
    casos = []
    for expr, iniciales in NEWTON:
        for x0 in iniciales:
            for tol, max_iter in ((1e-4, 100), (1e-10, 100), (1.0, 100), (1e-8, 4)):
                modos = ["simbolica", "numerica"] + (["explicita"] if expr in DERIVADAS_EXPLICITAS else [])
                for modo in modos:
                    caso = {"expr": expr, "x0": x0, "tol": tol, "max_iter": max_iter, "modo": modo}

                    def correr():
                        f = crear_funcion(expr)
                        if modo == "simbolica":
                            df, texto = derivada_simbolica(expr)
                            caso["df_python"] = texto
                        elif modo == "explicita":
                            caso["df_expr"] = DERIVADAS_EXPLICITAS[expr]
                            df = crear_funcion(DERIVADAS_EXPLICITAS[expr])
                        else:
                            df = None
                        return newton_raphson(f, x0, df=df, tol=tol, max_iter=max_iter)

                    caso["resultado"] = intentar(correr)
                    casos.append(caso)
    return casos


# ---------------------------------------------------------------------------
# Müller
# ---------------------------------------------------------------------------

MULLER = [
    ("x^3 - 13x - 12", [(4.5, 5.5, 5), (0, 1, 2), (-5, -4, -3.5), (-2, -1.5, -0.5), (10, 11, 12), (1, 1, 2), (1, 2, 1)]),
    ("x^2 + 1", [(0, 1, 2), (-1, 0, 1), (3, 4, 5), (0.5, 0.6, 0.7)]),
    ("x^3 + x + 1", [(0, 1, 2), (-1, -0.5, 0), (1, 2, 3)]),
    ("x^4 - 1", [(0.5, 0.7, 0.9), (0, 0.1, 0.2), (-3, -2, -1.5), (0.1, 0.2, 0.3)]),
    ("x^4 + 4", [(0, 1, 2), (1, 1.5, 2)]),
    ("exp(-x) - x", [(0, 1, 2), (-1, 0, 0.5), (5, 6, 7)]),
    ("sin(x) - x/2", [(1, 2, 3), (1.5, 2, 2.5), (-3, -2, -1)]),
    ("cos(x) - x", [(0, 0.5, 1), (2, 3, 4)]),
    ("x^2 - 2", [(0, 1, 2), (1, 1.4, 1.5), (-3, -2, -1)]),
    ("x^5 - 3.5x^4 + 2.75x^3 + 2.125x^2 - 3.875x + 1.25", [(0, 0.2, 0.4), (1.5, 2.5, 3), (-2, -1.5, -0.8), (0.8, 1, 1.2)]),
    ("exp(x) + 1", [(0, 1, 2), (-1, 0, 1)]),
    ("x^2 + x + 1", [(0, 1, 2), (-2, -1, 0)]),
    ("ln(x) - 1", [(1, 2, 3), (2, 2.5, 3)]),
    ("sqrt(x) - 2", [(1, 3, 5), (3, 4.5, 6)]),
    ("x^3", [(1, 2, 3), (-1, 0.5, 2)]),
    ("x - 5", [(0, 1, 2)]),                 # lineal: a = 0
    ("7", [(0, 1, 2)]),                     # constante: denominador cero
    ("x^6 + x^3 + 2", [(0, 1, 2), (-1, 0, 1)]),
    ("cosh(x) - 0.5", [(0, 1, 2)]),         # solo raíces complejas
    ("x*exp(x) - 1", [(0, 0.5, 1), (-2, -1, 0)]),
]


def casos_muller():
    casos = []
    for expr, ternas in MULLER:
        for x0, x1, x2 in ternas:
            for tol, max_iter in ((1e-4, 100), (1e-10, 100), (1.0, 100), (1e-8, 3)):
                caso = {"expr": expr, "x0": x0, "x1": x1, "x2": x2, "tol": tol, "max_iter": max_iter}
                caso["resultado"] = intentar(
                    lambda: muller(crear_funcion(expr), x0, x1, x2, tol=tol, max_iter=max_iter))
                casos.append(caso)
    return casos


# ---------------------------------------------------------------------------
# Bairstow
# ---------------------------------------------------------------------------

def casos_bairstow():
    casos = []

    def agregar(coefs, r, s, tol, max_iter):
        caso = {"coefs": coefs, "r": r, "s": s, "tol": tol, "max_iter": max_iter}
        caso["resultado"] = intentar(lambda: bairstow(coefs, r=r, s=s, tol=tol, max_iter=max_iter))
        casos.append(caso)

    agregar([1, -3.5, 2.75, 2.125, -3.875, 1.25], -1, -1, 1, 100)   # ejemplo 7.3
    agregar([1, -3.5, 2.75, 2.125, -3.875, 1.25], -1, -1, 1e-8, 100)
    agregar([1, -3, 2], -1, -1, 1e-4, 100)
    agregar([1, 0, 1], -1, -1, 1e-4, 100)
    agregar([2, -4], -1, -1, 1e-4, 100)
    agregar([5], -1, -1, 1e-4, 100)                  # grado 0: error
    agregar([0, 0, 3], -1, -1, 1e-4, 100)            # grado 0 tras quitar ceros: error
    agregar([0, 0, 1, -6, 11, -6], -1, -1, 1e-6, 100)  # ceros a la izquierda
    agregar([1, -6, 11, -6], 0, 0, 1e-6, 100)        # r = s = 0
    agregar([1, 0, 0, 0], -1, -1, 1e-6, 100)         # x^3
    agregar([1, 0, 0, 0, 0], 0, 0, 1e-6, 100)        # sistema singular
    agregar([1, 0, 0, -1], 1, 1, 1e-6, 100)
    agregar([1, -10, 35, -50, 24], -1, -1, 1e-6, 100)
    agregar([1, 2, 3, 4, 5, 6, 7], -1, -1, 1e-6, 200)

    for _ in range(600):
        grado = rnd.randint(1, 8)
        modo = rnd.random()
        if modo < 0.4:      # a partir de raíces reales conocidas
            pol = np.poly([rnd.randint(-5, 5) + rnd.choice([0, 0.5]) for _ in range(grado)])
            coefs = [float(c) * rnd.choice([1, 1, 2, -3]) for c in pol]
            coefs = [c * (coefs[0] and 1) for c in coefs]
        elif modo < 0.7:    # coeficientes enteros
            coefs = [float(rnd.randint(-9, 9)) for _ in range(grado + 1)]
        else:               # coeficientes decimales
            coefs = [round(rnd.uniform(-10, 10), 3) for _ in range(grado + 1)]
        if coefs[0] == 0 and rnd.random() < 0.8:
            coefs[0] = 1.0
        r, s = rnd.choice([(-1, -1), (-1, -1), (0.5, -0.5), (1, 1), (2, -3),
                           (round(rnd.uniform(-3, 3), 2), round(rnd.uniform(-3, 3), 2))])
        tol = rnd.choice([1, 0.01, 1e-6, 1e-10])
        max_iter = rnd.choice([3, 20, 100, 100, 300])
        agregar(coefs, r, s, tol, max_iter)
    return casos


# ---------------------------------------------------------------------------
# Formato
# ---------------------------------------------------------------------------

def casos_formato():
    numeros = [0.0, -0.0, 1.0, -1.0, 0.5, -0.25, 1 / 3, -2 / 3, 1e-7, -1e-7, 5e-7, 4.9999999e-7,
               123456.789, -98765.4321, 1e12, 1e15, 0.1 + 0.2, 2.5, 3.5, 1 / 128, 3 / 128, -5 / 128,
               0.0078125, 1.0000005, 2.0000015, 0.9999995, 0.99999949, 1e-10, 12.3456785, 1e21, 1.5e-5,
               100.0, 99.9999999, -0.0000004, 7.0, 1e11, 999999999999.0, 1e12 + 1, 0.56714329,
               1 + 0.5j, 1 - 0.5j, -2.25 + 0j, 0 - 1e-9j, 3.14159265358979 - 2.71828182845905j]
    for _ in range(600):
        escala = 10 ** rnd.randint(-8, 8)
        numeros.append(rnd.uniform(-1, 1) * escala)
    for _ in range(100):
        numeros.append(complex(rnd.uniform(-50, 50), rnd.uniform(-50, 50)))

    formato, limpio = [], []
    for v in numeros:
        for d in (4, 6, 8, 10):
            formato.append({"v": enc(v), "d": d, "texto": formatear_numero(v, d)})
            limpio.append({"v": enc(v), "d": d, "n": _n(v, d), "p": _p(v, d)})

    polinomios = [[1, -3.5, 0, 2], [1, -3, 2], [-1, 0, 0], [0, 0, 0], [2, 0, -1], [1, 1, 1, 1], [-1, -1, -1],
                  [1, -3.5, 2.75, 2.125, -3.875, 1.25], [5], [0, 3], [1, 0], [-1, 0], [2.5, -0.001, 100],
                  [1, -1], [10, 0, 0, 0, -1], [0.5, 0.25], [1, 0, 0, 0, 0, 0, 0, 0, 1]]
    for _ in range(150):
        polinomios.append([rnd.choice([0, 1, -1, rnd.randint(-9, 9), round(rnd.uniform(-9, 9), 2)])
                           for _ in range(rnd.randint(1, 7))])
    pols = [{"coefs": c, "texto": polinomio_a_texto(c)} for c in polinomios]
    return formato, limpio, pols


def main():
    formato, limpio, polinomios = casos_formato()
    datos = {
        "expresiones": casos_expresiones(),
        "sistemas": casos_sistemas(),
        "newton": casos_newton(),
        "muller": casos_muller(),
        "bairstow": casos_bairstow(),
        "formato": formato,
        "limpio": limpio,
        "polinomios": polinomios,
    }
    destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), "referencia.json")
    with open(destino, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False)
    print({k: len(v) for k, v in datos.items()})


if __name__ == "__main__":
    main()

"""
Métodos iterativos para resolver sistemas de ecuaciones lineales Ax = b.

Implementa Jacobi y Gauss-Seidel de forma simple y legible, siguiendo
la formulación clásica (Chapra & Canale, Burden & Faires):

    Jacobi:        x_i^(k+1) = ( b_i - sum_{j!=i} a_ij * x_j^(k) ) / a_ii
    Gauss-Seidel:  x_i^(k+1) = ( b_i - sum_{j<i} a_ij*x_j^(k+1)
                                     - sum_{j>i} a_ij*x_j^(k) ) / a_ii
"""

import numpy as np


def es_diagonalmente_dominante(A: np.ndarray) -> bool:
    """Verifica dominancia diagonal estricta por filas: |a_ii| > sum_{j!=i} |a_ij|."""
    A = np.asarray(A, dtype=float)
    n = A.shape[0]
    for i in range(n):
        diagonal = abs(A[i, i])
        resto = sum(abs(A[i, j]) for j in range(n) if j != i)
        if diagonal <= resto:
            return False
    return True


def jacobi(A, b, x0=None, tol=1e-6, max_iter=100):
    """
    Resuelve Ax = b con el método de Jacobi.

    Retorna un diccionario con:
        x           -> solución aproximada (última iteración)
        historial   -> lista de vectores x en cada iteración (incluye x0)
        iteraciones -> número de iteraciones realizadas
        convergio   -> True si se cumplió la tolerancia antes de max_iter
    """
    A = np.asarray(A, dtype=float)
    b = np.asarray(b, dtype=float)
    n = A.shape[0]
    x = np.zeros(n) if x0 is None else np.array(x0, dtype=float)

    historial = [x.copy()]
    convergio = False

    for k in range(1, max_iter + 1):
        x_nuevo = np.zeros(n)
        for i in range(n):
            suma = sum(A[i, j] * x[j] for j in range(n) if j != i)
            x_nuevo[i] = (b[i] - suma) / A[i, i]

        historial.append(x_nuevo.copy())
        error = np.linalg.norm(x_nuevo - x, ord=np.inf)
        x = x_nuevo

        if error < tol:
            convergio = True
            break

    return {"x": x, "historial": historial, "iteraciones": k, "convergio": convergio}


def gauss_seidel(A, b, x0=None, tol=1e-6, max_iter=100):
    """
    Resuelve Ax = b con el método de Gauss-Seidel.

    Misma interfaz de retorno que jacobi(). A diferencia de Jacobi, cada
    componente se actualiza usando de inmediato los valores ya calculados
    en la misma iteración.
    """
    A = np.asarray(A, dtype=float)
    b = np.asarray(b, dtype=float)
    n = A.shape[0]
    x = np.zeros(n) if x0 is None else np.array(x0, dtype=float)

    historial = [x.copy()]
    convergio = False

    for k in range(1, max_iter + 1):
        x_anterior = x.copy()
        for i in range(n):
            suma = sum(A[i, j] * x[j] for j in range(n) if j != i)
            x[i] = (b[i] - suma) / A[i, i]

        historial.append(x.copy())
        error = np.linalg.norm(x - x_anterior, ord=np.inf)

        if error < tol:
            convergio = True
            break

    return {"x": x, "historial": historial, "iteraciones": k, "convergio": convergio}


def imprimir_tabla(historial, encabezados=None):
    """Imprime el historial de iteraciones como una tabla legible en consola."""
    n = len(historial[0])
    encabezados = encabezados or [f"x{i+1}" for i in range(n)]

    ancho = 14
    print(f"{'k':>3} " + "".join(f"{h:>{ancho}}" for h in encabezados))
    for k, x in enumerate(historial):
        valores = "".join(f"{v:>{ancho}.6f}" for v in x)
        print(f"{k:>3} {valores}")

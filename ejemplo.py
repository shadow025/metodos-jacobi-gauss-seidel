"""
Ejemplo de uso: mismo sistema 3x3 usado en la guía de Métodos Numéricos.

    20 x1 +   x2 -  x3 = 17
     3 x1 + 20 x2 +  x3 = -18
     2 x1 -  3 x2 + 20 x3 = 25

Ejecutar con:  python ejemplo.py
"""

import numpy as np

from metodos_iterativos import (
    es_diagonalmente_dominante,
    gauss_seidel,
    imprimir_tabla,
    jacobi,
)

A = [
    [20, 1, -1],
    [3, 20, 1],
    [2, -3, 20],
]
b = [17, -18, 25]


def main():
    print("Sistema Ax = b")
    print("A =", np.array(A))
    print("b =", np.array(b))
    print()
    print("¿Diagonalmente dominante?", es_diagonalmente_dominante(A))
    print()

    print("=" * 60)
    print("MÉTODO DE JACOBI (6 iteraciones)")
    print("=" * 60)
    resultado_jacobi = jacobi(A, b, max_iter=6, tol=0)  # tol=0 -> siempre hace las 6
    imprimir_tabla(resultado_jacobi["historial"])
    print("\nSolución aproximada:", resultado_jacobi["x"])

    print()
    print("=" * 60)
    print("MÉTODO DE GAUSS-SEIDEL (hasta convergencia, tol=1e-6)")
    print("=" * 60)
    resultado_gs = gauss_seidel(A, b, tol=1e-6, max_iter=50)
    imprimir_tabla(resultado_gs["historial"])
    print(f"\nConvergió en {resultado_gs['iteraciones']} iteraciones:", resultado_gs["x"])

    print()
    solucion_exacta = np.linalg.solve(np.array(A, dtype=float), np.array(b, dtype=float))
    print("Solución exacta (numpy.linalg.solve):", solucion_exacta)


if __name__ == "__main__":
    main()

"""Pruebas básicas para los métodos de Jacobi y Gauss-Seidel."""

import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from metodos_iterativos import es_diagonalmente_dominante, gauss_seidel, jacobi

A = [
    [20, 1, -1],
    [3, 20, 1],
    [2, -3, 20],
]
b = [17, -18, 25]


class TestMetodosIterativos(unittest.TestCase):
    def setUp(self):
        self.solucion_exacta = np.linalg.solve(
            np.array(A, dtype=float), np.array(b, dtype=float)
        )

    def test_dominancia_diagonal(self):
        self.assertTrue(es_diagonalmente_dominante(A))
        self.assertFalse(es_diagonalmente_dominante([[1, 5], [1, 1]]))

    def test_jacobi_converge_a_la_solucion_exacta(self):
        resultado = jacobi(A, b, tol=1e-8, max_iter=100)
        self.assertTrue(resultado["convergio"])
        np.testing.assert_allclose(resultado["x"], self.solucion_exacta, atol=1e-6)

    def test_gauss_seidel_converge_a_la_solucion_exacta(self):
        resultado = gauss_seidel(A, b, tol=1e-8, max_iter=100)
        self.assertTrue(resultado["convergio"])
        np.testing.assert_allclose(resultado["x"], self.solucion_exacta, atol=1e-6)

    def test_gauss_seidel_converge_mas_rapido_que_jacobi(self):
        r_jacobi = jacobi(A, b, tol=1e-6, max_iter=100)
        r_gs = gauss_seidel(A, b, tol=1e-6, max_iter=100)
        self.assertLessEqual(r_gs["iteraciones"], r_jacobi["iteraciones"])


if __name__ == "__main__":
    unittest.main()

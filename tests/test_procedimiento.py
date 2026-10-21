"""El procedimiento paso a paso debe contener los valores de los ejemplos resueltos a mano."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from metodos_iterativos import gauss_seidel, jacobi
from metodos_raices import bairstow, crear_funcion, muller, newton_raphson
from procedimiento import (
    procedimiento_bairstow,
    procedimiento_muller,
    procedimiento_newton,
    procedimiento_sistema,
)

A = [[4, -1, 1], [4, -8, 1], [-2, 1, 5]]
b = [7, -21, 15]


class TestProcedimiento(unittest.TestCase):
    def test_jacobi_muestra_despejes_e_iteraciones(self):
        texto = procedimiento_sistema("Jacobi", A, b, jacobi(A, b, tol=1e-4), 1e-4)
        self.assertIn("x1 = (7 - (-1)·x2 - 1·x3) / 4", texto)
        self.assertIn("Error = máx(1.75, 2.625, 3) = 3", texto)
        self.assertIn("x2 = (-21 - 4·1.75 - 1·3) / (-8) = 3.875", texto)
        self.assertIn("Convergió", texto)

    def test_gauss_seidel_marca_valores_actualizados(self):
        texto = procedimiento_sistema("Gauss-Seidel", A, b, gauss_seidel(A, b, tol=1e-4), 1e-4)
        self.assertIn("x2 = (-21 - 4·1.75* - 1·0) / (-8) = 3.5", texto)
        self.assertIn("Error = máx(1.75, 3.5, 3) = 3.5", texto)

    def test_newton_sustituye_la_formula(self):
        r = newton_raphson(crear_funcion("x^2 - 2"), 1, df=crear_funcion("2x"), tol=1)
        texto = procedimiento_newton("x^2 - 2", "2x", r, 1)
        self.assertIn("x1 = 1 − (-1) / (2) = 1.5", texto)
        self.assertIn("x2 = 1.5 − (0.25) / (3) = 1.41666667", texto)
        self.assertIn("se detiene", texto)

    def test_muller_valores_intermedios(self):
        r = muller(crear_funcion("x^3 - x - 1"), 1, 1.5, 2, tol=0.1)
        texto = procedimiento_muller("x^3 - x - 1", r, 0.1)
        self.assertIn("a = (8.25 − 3.75) / (0.5 + 0.5) = 4.5", texto)
        self.assertIn("√(20.25) = 4.5", texto)
        self.assertIn("x3 = 2 − 2·5 / 15 = 1.333333", texto)

    def test_muller_complejo_con_parentesis(self):
        r = muller(crear_funcion("x^2 + 4"), 0, 1, 2, tol=0.1)
        texto = procedimiento_muller("x^2 + 4", r, 0.1)
        self.assertIn("/ (4.000000 + 4.000000i) = 0.000000 + 2.000000i", texto)
        self.assertIn("conjugada", texto)

    def test_bairstow_division_sintetica_y_sistema(self):
        r = bairstow([1, -6, 11, -6], r=1, s=1, tol=1)
        texto = procedimiento_bairstow(r, 1)
        self.assertIn("b1 = a1 + r·b2 + s·b3 = 11 + 1·(-5) + 1·1 = 7", texto)
        self.assertIn("(-4)·Δr + 1·Δs = -7", texto)
        self.assertIn("Δr = ((-7)·(-4) − 4·1) / 12 = 2", texto)
        self.assertIn("Polinomio reducido (cociente b3…b2): x - 3", texto)
        self.assertIn("x3 = 3.000000", texto)


if __name__ == "__main__":
    unittest.main()

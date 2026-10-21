"""Pruebas de Newton-Raphson, Müller y Bairstow contra los ejemplos de Chapra & Canale."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from metodos_raices import (
    bairstow,
    crear_funcion,
    evaluar_polinomio,
    muller,
    newton_raphson,
    polinomio_a_texto,
)


class TestCrearFuncion(unittest.TestCase):
    def test_acepta_potencia_con_caret_y_producto_implicito(self):
        f = crear_funcion("x^3 - 13x - 12")
        self.assertAlmostEqual(f(4), 0.0)
        self.assertAlmostEqual(f(2), 8 - 26 - 12)

    def test_funciones_matematicas(self):
        f = crear_funcion("exp(-x) - x")
        self.assertAlmostEqual(f(0), 1.0)
        g = crear_funcion("sen(x) + ln(e)")
        self.assertAlmostEqual(g(0), 1.0)

    def test_expresion_invalida(self):
        with self.assertRaises(ValueError):
            crear_funcion("2 *")
        with self.assertRaises(ValueError):
            crear_funcion("foo(x)")


class TestNewtonRaphson(unittest.TestCase):
    """Ejemplo 6.3: f(x) = e^-x - x, x0 = 0 -> raíz 0.56714329."""

    def test_converge_con_derivada_analitica(self):
        f = crear_funcion("exp(-x) - x")
        df = crear_funcion("-exp(-x) - 1")
        r = newton_raphson(f, 0, df=df, tol=1e-6)
        self.assertTrue(r["convergio"])
        self.assertAlmostEqual(r["raiz"], 0.56714329, places=7)
        # primera iteración del libro: x1 = 0.5
        self.assertAlmostEqual(r["historial"][0]["x_nuevo"], 0.5)
        self.assertAlmostEqual(r["historial"][1]["x_nuevo"], 0.566311003, places=8)

    def test_converge_con_derivada_numerica(self):
        f = crear_funcion("exp(-x) - x")
        r = newton_raphson(f, 0, tol=1e-6)
        self.assertTrue(r["convergio"])
        self.assertAlmostEqual(r["raiz"], 0.56714329, places=6)

    def test_derivada_cero_lanza_error(self):
        f = crear_funcion("x^2 - 1")
        with self.assertRaises(ZeroDivisionError):
            newton_raphson(f, 0, df=crear_funcion("2x"))


class TestMuller(unittest.TestCase):
    """Ejemplo 7.2: f(x) = x^3 - 13x - 12 con x0=4.5, x1=5.5, x2=5 -> raíz 4."""

    def test_primera_iteracion_y_convergencia(self):
        f = crear_funcion("x^3 - 13x - 12")
        r = muller(f, 4.5, 5.5, 5, tol=1e-4)
        self.assertAlmostEqual(r["historial"][0]["x3"], 3.976487, places=6)
        self.assertAlmostEqual(r["historial"][0]["error"], 25.74, places=2)
        self.assertTrue(r["convergio"])
        self.assertAlmostEqual(r["raiz"], 4.0, places=6)

    def test_encuentra_raiz_compleja(self):
        f = crear_funcion("x^2 + 1")  # raíces ±i
        r = muller(f, 0, 0.5, 1, tol=1e-8)
        self.assertTrue(r["convergio"])
        self.assertIsInstance(r["raiz"], complex)
        self.assertAlmostEqual(abs(r["raiz"].imag), 1.0, places=6)
        self.assertAlmostEqual(r["raiz"].real, 0.0, places=6)


class TestBairstow(unittest.TestCase):
    """Ejemplo 7.3: x^5 - 3.5x^4 + 2.75x^3 + 2.125x^2 - 3.875x + 1.25."""

    COEFS = [1, -3.5, 2.75, 2.125, -3.875, 1.25]

    def test_primera_iteracion_del_libro(self):
        r = bairstow(self.COEFS, r=-1, s=-1, tol=1)
        h = r["factores"][0]["historial"][0]
        self.assertAlmostEqual(h["delta_r"], 0.3558, places=4)
        self.assertAlmostEqual(h["delta_s"], 1.1381, places=4)
        self.assertAlmostEqual(h["r_nuevo"], -0.6442, places=4)
        self.assertAlmostEqual(h["s_nuevo"], 0.1381, places=4)

    def test_encuentra_las_cinco_raices(self):
        r = bairstow(self.COEFS, r=-1, s=-1, tol=1e-6)
        self.assertTrue(r["convergio"])
        self.assertEqual(len(r["raices"]), 5)
        esperadas = [0.5, -1.0, 2.0, 1 + 0.5j, 1 - 0.5j]
        for esperada in esperadas:
            self.assertTrue(
                any(abs(complex(raiz) - esperada) < 1e-5 for raiz in r["raices"]),
                f"No se encontró la raíz {esperada}: {r['raices']}",
            )
        for raiz in r["raices"]:
            self.assertLess(abs(evaluar_polinomio(self.COEFS, raiz)), 1e-6)

    def test_grado_dos_y_uno_sin_iterar(self):
        r = bairstow([1, -3, 2])  # (x-1)(x-2)
        self.assertEqual(sorted(r["raices"]), [1.0, 2.0])
        self.assertEqual(r["factores"][0]["historial"], [])
        r = bairstow([2, -4])  # 2x - 4
        self.assertEqual(r["raices"], [2.0])

    def test_polinomio_a_texto(self):
        self.assertEqual(polinomio_a_texto([1, -3, 2]), "x^2 - 3x + 2")
        self.assertEqual(polinomio_a_texto([-2, 0, 1]), "-2x^2 + 1")


if __name__ == "__main__":
    unittest.main()

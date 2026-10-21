"""
Ejemplos de Chapra & Canale resueltos con los tres métodos de raíces.

    Newton-Raphson: Ejemplo 6.3  f(x) = e^-x - x,          x0 = 0
    Müller:         Ejemplo 7.2  f(x) = x^3 - 13x - 12,     x0=4.5, x1=5.5, x2=5
    Bairstow:       Ejemplo 7.3  x^5 - 3.5x^4 + 2.75x^3 + 2.125x^2 - 3.875x + 1.25,  r = s = -1

Ejecutar con:  python ejemplo_raices.py
"""

from metodos_raices import (
    bairstow,
    crear_funcion,
    formatear_numero,
    muller,
    newton_raphson,
    polinomio_a_texto,
)


def titulo(texto):
    print()
    print("=" * 70)
    print(texto)
    print("=" * 70)


def main():
    titulo("NEWTON-RAPHSON  (Ejemplo 6.3):  f(x) = exp(-x) - x,  x0 = 0")
    f = crear_funcion("exp(-x) - x")
    df = crear_funcion("-exp(-x) - 1")
    r = newton_raphson(f, 0, df=df, tol=1e-6)
    print(f"{'i':>3} {'x_i':>14} {'f(x_i)':>14} {'x_i+1':>14} {'εa (%)':>12}")
    for h in r["historial"]:
        print(f"{h['i']:>3} {h['x']:>14.8f} {h['fx']:>14.8f} {h['x_nuevo']:>14.8f} {h['error']:>12.6f}")
    print(f"\nRaíz ≈ {r['raiz']:.8f} en {r['iteraciones']} iteraciones")

    titulo("MÜLLER  (Ejemplo 7.2):  f(x) = x^3 - 13x - 12,  x0=4.5  x1=5.5  x2=5")
    g = crear_funcion("x^3 - 13x - 12")
    m = muller(g, 4.5, 5.5, 5, tol=1e-4)
    print(f"{'i':>3} {'x0':>12} {'x1':>12} {'x2':>12} {'x3':>12} {'εa (%)':>12}")
    for h in m["historial"]:
        print(f"{h['i']:>3} {h['x0']:>12.6f} {h['x1']:>12.6f} {h['x2']:>12.6f} "
              f"{formatear_numero(h['x3']):>12} {h['error']:>12.6f}")
    print(f"\nRaíz ≈ {formatear_numero(m['raiz'], 8)} en {m['iteraciones']} iteraciones")

    coefs = [1, -3.5, 2.75, 2.125, -3.875, 1.25]
    titulo(f"BAIRSTOW  (Ejemplo 7.3):  f(x) = {polinomio_a_texto(coefs)},  r = s = -1,  εs = 1 %")
    b = bairstow(coefs, r=-1, s=-1, tol=1)
    for num, factor in enumerate(b["factores"], 1):
        print(f"\nFactor {num} (polinomio de grado {factor['grado']}: {polinomio_a_texto(factor['polinomio'])})")
        if factor["historial"]:
            print(f"{'i':>3} {'r':>12} {'s':>12} {'Δr':>12} {'Δs':>12} {'εr (%)':>10} {'εs (%)':>10}")
            for h in factor["historial"]:
                print(f"{h['i']:>3} {h['r']:>12.6f} {h['s']:>12.6f} {h['delta_r']:>12.6f} "
                      f"{h['delta_s']:>12.6f} {h['error_r']:>10.4f} {h['error_s']:>10.4f}")
        else:
            print("  (grado 2: se resuelve directamente con la fórmula cuadrática)")
        x1, x2 = factor["raices"]
        print(f"  -> r = {factor['r']:.6f}, s = {factor['s']:.6f}   raíces: {formatear_numero(x1)}, {formatear_numero(x2)}")
    print("\nRaíces del polinomio:")
    for i, raiz in enumerate(b["raices"], 1):
        print(f"  x{i} = {formatear_numero(raiz)}")


if __name__ == "__main__":
    main()

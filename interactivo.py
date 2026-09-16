"""
Modo interactivo: permite ingresar el sistema Ax = b por teclado
(tamaño, matriz A, vector b, vector inicial, tolerancia, iteraciones)
y resolverlo con Jacobi, Gauss-Seidel, o ambos para comparar.

Ejecutar con:  python interactivo.py
"""

from metodos_iterativos import (
    es_diagonalmente_dominante,
    gauss_seidel,
    imprimir_tabla,
    jacobi,
)


def pedir_entero(mensaje, minimo=1, por_defecto=None):
    while True:
        texto = input(mensaje).strip()
        if texto == "" and por_defecto is not None:
            return por_defecto
        try:
            valor = int(texto)
        except ValueError:
            print("  Ingresa un número entero válido.")
            continue
        if valor < minimo:
            print(f"  Debe ser un número mayor o igual a {minimo}.")
            continue
        return valor


def pedir_flotante(mensaje, por_defecto=None):
    texto = input(mensaje).strip()
    if texto == "" and por_defecto is not None:
        return por_defecto
    try:
        return float(texto)
    except ValueError:
        print(f"  Valor inválido, se usará {por_defecto}.")
        return por_defecto


def pedir_fila(n, etiqueta):
    while True:
        texto = input(f"  {etiqueta}: ").strip().split()
        try:
            valores = [float(v) for v in texto]
        except ValueError:
            print("  Todos los valores deben ser números. Intenta de nuevo.")
            continue
        if len(valores) != n:
            print(f"  Se esperaban {n} valores, ingresaste {len(valores)}. Intenta de nuevo.")
            continue
        return valores


def pedir_matriz(n):
    print(f"\nIngresa la matriz A ({n}x{n}), fila por fila, valores separados por espacio:")
    return [pedir_fila(n, f"Fila {i + 1}") for i in range(n)]


def pedir_vector(n, nombre):
    print(f"\nIngresa el vector {nombre} ({n} valores separados por espacio):")
    return pedir_fila(n, nombre)


def mostrar_resultado(nombre_metodo, resultado):
    print("\n" + "=" * 60)
    print(f"MÉTODO DE {nombre_metodo}")
    print("=" * 60)
    imprimir_tabla(resultado["historial"])
    estado = "Convergió" if resultado["convergio"] else "NO convergió (se alcanzó el máximo de iteraciones)"
    print(f"\n{estado} en {resultado['iteraciones']} iteraciones.")
    print("Solución aproximada:", resultado["x"])


def main():
    print("=" * 60)
    print("  RESOLVER Ax = b  —  Jacobi / Gauss-Seidel")
    print("=" * 60)

    n = pedir_entero("\n¿Cuántas variables/ecuaciones tiene el sistema? ")
    A = pedir_matriz(n)
    b = pedir_vector(n, "b")

    filas_diagonal_cero = [i + 1 for i in range(n) if A[i][i] == 0]
    if filas_diagonal_cero:
        print(
            f"\n⚠ La fila(s) {filas_diagonal_cero} tiene un 0 en la diagonal: "
            "el método dividiría entre cero. Reordena las ecuaciones (o filas) "
            "para que la diagonal no tenga ceros y vuelve a intentarlo."
        )
        return

    dominante = es_diagonalmente_dominante(A)
    print(f"\n¿La matriz es diagonalmente dominante? {'Sí' if dominante else 'No'}")
    if not dominante:
        print("  Advertencia: no está garantizada la convergencia, aunque puede converger igual.")

    respuesta = input("\n¿Vector inicial x0? (Enter = ceros, o 's' para ingresarlo): ").strip().lower()
    x0 = pedir_vector(n, "x0") if respuesta == "s" else None

    tol = pedir_flotante("\nTolerancia (Enter = 1e-6): ", por_defecto=1e-6)
    max_iter = pedir_entero("Número máximo de iteraciones (Enter = 100): ", por_defecto=100)

    opcion = ""
    while opcion not in ("1", "2", "3"):
        opcion = input(
            "\n¿Qué método quieres usar?\n"
            "  1. Jacobi\n"
            "  2. Gauss-Seidel\n"
            "  3. Ambos (para comparar)\n"
            "Opción: "
        ).strip()

    if opcion in ("1", "3"):
        mostrar_resultado("JACOBI", jacobi(A, b, x0=x0, tol=tol, max_iter=max_iter))

    if opcion in ("2", "3"):
        mostrar_resultado("GAUSS-SEIDEL", gauss_seidel(A, b, x0=x0, tol=tol, max_iter=max_iter))


if __name__ == "__main__":
    main()

# Métodos Iterativos: Jacobi y Gauss-Seidel

Implementación en Python de los métodos de **Jacobi** y **Gauss-Seidel** para
resolver sistemas de ecuaciones lineales `Ax = b`, como parte de la materia
de Métodos Numéricos (FESC).

📖 **Guía de uso paso a paso:** ver [`GUIA_DE_USO.md`](GUIA_DE_USO.md).

## Contenido

- `metodos_iterativos.py` — funciones `jacobi()`, `gauss_seidel()` y
  `es_diagonalmente_dominante()`.
- `interactivo.py` — te permite ingresar tu propio sistema (n, matriz A,
  vector b, x0, tolerancia, iteraciones) por teclado y resolverlo.
- `ejemplo.py` — ejecuta ambos métodos sobre un sistema 3x3 de ejemplo y
  muestra la tabla de iteraciones.
- `tests/test_metodos.py` — pruebas unitarias (`unittest`) que verifican
  que ambos métodos convergen a la solución correcta.
- `GUIA_DE_USO.md` — guía detallada de instalación y uso, con un ejemplo
  de sesión interactiva y solución de problemas comunes.

## Instalación

```bash
python -m venv .venv
source .venv/bin/activate   # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Uso

### Ingresar tu propio sistema

```bash
python interactivo.py
```

Te pregunta el tamaño del sistema, la matriz A, el vector b, el vector
inicial, la tolerancia, el máximo de iteraciones y qué método usar. Ver el
ejemplo de sesión completa en [`GUIA_DE_USO.md`](GUIA_DE_USO.md).

### Ejemplo fijo

```bash
python ejemplo.py
```

Esto imprime, para el sistema:

```
20x1 +  x2 -  x3 = 17
 3x1 + 20x2 +  x3 = -18
 2x1 - 3x2 + 20x3 = 25
```

la tabla de 6 iteraciones de Jacobi y la convergencia completa de
Gauss-Seidel, junto con la solución exacta calculada con `numpy.linalg.solve`
para comparar.

## Ejecutar las pruebas

```bash
python -m unittest discover -s tests
```

## Uso como librería

```python
from metodos_iterativos import jacobi, gauss_seidel

A = [[20, 1, -1], [3, 20, 1], [2, -3, 20]]
b = [17, -18, 25]

resultado = gauss_seidel(A, b, tol=1e-6, max_iter=100)
print(resultado["x"])            # solución aproximada
print(resultado["iteraciones"])  # número de iteraciones que tomó
print(resultado["convergio"])    # True/False
```

## Referencias

- Chapra, S. C. & Canale, R. P. — *Métodos Numéricos para Ingenieros*.
- Burden, R. L. & Faires, J. D. — *Numerical Analysis* (cap. Iterative
  Techniques in Matrix Algebra).
- [Método de Jacobi — Wikipedia](https://es.wikipedia.org/wiki/M%C3%A9todo_de_Jacobi)
- [Gauss–Seidel method — Wikipedia](https://en.wikipedia.org/wiki/Gauss%E2%80%93Seidel_method)

# Métodos Numéricos: Jacobi, Gauss-Seidel, Newton-Raphson, Müller y Bairstow

Implementación en Python, como parte de la materia de Métodos Numéricos (FESC), de:

- **Jacobi** y **Gauss-Seidel** para resolver sistemas de ecuaciones lineales `Ax = b`.
- **Newton-Raphson** para encontrar raíces de `f(x) = 0`.
- **Müller** para encontrar raíces reales o complejas de `f(x) = 0`.
- **Bairstow** para encontrar todas las raíces (reales y complejas) de un polinomio.

Los métodos de raíces siguen la formulación de Chapra & Canale, *Métodos numéricos
para ingenieros* (secciones 6.2, 7.2 y 7.5) y reproducen sus ejemplos 6.3, 7.2 y 7.3.

📖 **Guía de uso paso a paso:** ver [`GUIA_DE_USO.md`](GUIA_DE_USO.md).

## Contenido

- `interfaz.py` — **interfaz gráfica** (Tkinter) con una pestaña por método:
  ingresas los datos, presionas *Resolver* y ves la tabla de iteraciones y el
  resultado. Cada pestaña tiene un botón *Cargar ejemplo* con el ejemplo del libro.
- `metodos_iterativos.py` — funciones `jacobi()`, `gauss_seidel()` y
  `es_diagonalmente_dominante()`.
- `metodos_raices.py` — funciones `newton_raphson()`, `muller()`, `bairstow()` y
  `crear_funcion()` (convierte un texto como `exp(-x) - x` en una función evaluable).
- `interactivo.py` — modo consola para Jacobi / Gauss-Seidel.
- `ejemplo.py` — sistema 3x3 de ejemplo resuelto con Jacobi y Gauss-Seidel.
- `ejemplo_raices.py` — ejemplos 6.3, 7.2 y 7.3 del libro resueltos con
  Newton-Raphson, Müller y Bairstow, con sus tablas de iteraciones.
- `tests/` — pruebas unitarias (`unittest`) de los cinco métodos.

## Instalación

```bash
python -m venv .venv
source .venv/bin/activate   # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

`numpy` es la única dependencia obligatoria. `sympy` es opcional: si está
instalado, Newton-Raphson deriva `f(x)` simbólicamente; si no, usa derivada
numérica (diferencias centrales). Tkinter viene incluido con Python.

## Uso

### Interfaz gráfica (recomendado)

```bash
python interfaz.py
```

| Pestaña | Qué ingresas |
|---|---|
| Jacobi / Gauss-Seidel | Matriz A (una fila por línea), vector b, x0 opcional, tolerancia, iteraciones y qué método usar |
| Newton-Raphson | `f(x)`, `f'(x)` opcional, `x0`, tolerancia εs (%) e iteraciones |
| Müller | `f(x)`, los tres puntos `x0, x1, x2`, tolerancia εs (%) e iteraciones |
| Bairstow | Coeficientes del polinomio (del grado mayor al menor), `r` y `s` iniciales, tolerancia εs (%) e iteraciones |

Las funciones se escriben con `x` como variable: `exp(-x) - x`, `x^3 - 13x - 12`,
`sin(x) - x/2`. Se aceptan `^` o `**` para potencias y las funciones `sin`, `cos`,
`tan`, `exp`, `log` (o `ln`), `log10`, `sqrt`, `abs`, más las constantes `pi` y `e`.

### Ejemplos fijos

```bash
python ejemplo.py          # Jacobi y Gauss-Seidel, sistema 3x3
python ejemplo_raices.py   # Newton-Raphson, Müller y Bairstow, ejemplos del libro
```

### Modo consola (solo sistemas lineales)

```bash
python interactivo.py
```

## Ejecutar las pruebas

```bash
python -m unittest discover -s tests
```

## Uso desde código

```python
from metodos_raices import bairstow, crear_funcion, muller, newton_raphson

f = crear_funcion("exp(-x) - x")
newton_raphson(f, x0=0, tol=1e-6)["raiz"]            # 0.56714329

g = crear_funcion("x^3 - 13x - 12")
muller(g, 4.5, 5.5, 5, tol=1e-4)["raiz"]              # 4.0

bairstow([1, -3.5, 2.75, 2.125, -3.875, 1.25], r=-1, s=-1, tol=1)["raices"]
# [0.5, -1.0, 1+0.5i, 1-0.5i, 2.0]
```

Cada función devuelve un diccionario con la raíz (o raíces), el `historial`
de iteraciones (una fila por iteración con los valores intermedios), el número
de `iteraciones` y si `convergio`.

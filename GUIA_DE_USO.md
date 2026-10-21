# Guía de uso

Guía práctica para instalar y ejecutar el proyecto de **Métodos Numéricos**
(Jacobi, Gauss-Seidel, Newton-Raphson, Müller y Bairstow).
Si solo quieres los pasos mínimos para correrlo, ve directo a la
[sección 2](#2-instalación).

## 1. ¿Qué archivo uso?

| Quiero... | Archivo a ejecutar |
|---|---|
| Usar cualquiera de los cinco métodos con mis propios datos, con ventana gráfica | `interfaz.py` |
| Ingresar un sistema de ecuaciones por teclado (consola) | `interactivo.py` |
| Ver el sistema 3×3 de ejemplo resuelto con Jacobi y Gauss-Seidel | `ejemplo.py` |
| Ver los ejemplos del libro resueltos con Newton-Raphson, Müller y Bairstow | `ejemplo_raices.py` |
| Verificar que el código funciona correctamente | `tests/` |

## 2. Instalación

Necesitas Python 3.9 o superior instalado (con Tkinter, que viene incluido en
el instalador oficial de python.org).

```bash
cd metodos-jacobi-gauss-seidel

# (Opcional pero recomendado) crear un entorno virtual
python -m venv .venv
source .venv/bin/activate      # En Windows: .venv\Scripts\activate

# Instalar dependencias (numpy obligatorio, sympy opcional)
pip install -r requirements.txt
```

## 3. Interfaz gráfica

```bash
python interfaz.py
```

Se abre una ventana con cuatro pestañas. En todas:

- **Cargar ejemplo** llena los campos con el ejemplo de clase / del libro.
- **Resolver** ejecuta el método y muestra la tabla de iteraciones y el resumen.
- Si algún dato está mal escrito, aparece un mensaje explicando qué corregir.

### 3.1 Jacobi / Gauss-Seidel

1. **Matriz A**: una fila por línea, valores separados por espacio.
2. **Vector b**: los n valores separados por espacio.
3. **x0** (opcional): vacío = vector de ceros.
4. **Tolerancia** (norma infinito de la diferencia entre iteraciones) y
   **máximo de iteraciones**.
5. Elige **Jacobi**, **Gauss-Seidel** o **Ambos** (muestra las dos tablas para comparar).

La tabla muestra `k`, cada `x_i` y el error de esa iteración. El resumen indica
si convergió, la solución y si la matriz es diagonalmente dominante.

### 3.2 Newton-Raphson

1. **f(x)**: por ejemplo `exp(-x) - x`.
2. **f'(x)** (opcional): si la dejas vacía, el programa deriva automáticamente
   (simbólicamente con `sympy` si está instalado; si no, numéricamente). El
   resumen indica qué derivada se usó.
3. **x0**, **tolerancia εs (%)** y **máximo de iteraciones**.

Tabla: `i`, `x_i`, `f(x_i)`, `f'(x_i)`, `x_{i+1}` y `εa (%)`, donde
`εa = |(x_{i+1} - x_i) / x_{i+1}| · 100`.

### 3.3 Müller

1. **f(x)**: por ejemplo `x^3 - 13x - 12`.
2. **x0, x1, x2**: los tres puntos iniciales (deben ser distintos).
3. **Tolerancia εs (%)** y **máximo de iteraciones**.

Tabla: los tres puntos de cada iteración, la nueva aproximación `x3` y `εa (%)`.
Si la raíz es compleja, se muestra como `a + bi`. Prueba `x^2 + 1` con
`x0=0, x1=0.5, x2=1` para ver una raíz compleja.

### 3.4 Bairstow

1. **Coeficientes**: del grado mayor al menor, separados por espacio.
   Debajo se muestra el polinomio interpretado para que verifiques.
   Ejemplo: `x^5 - 3.5x^4 + 2.75x^3 + 2.125x^2 - 3.875x + 1.25` se escribe
   `1 -3.5 2.75 2.125 -3.875 1.25`. Si un término no existe pon `0`.
2. **r y s iniciales** del factor cuadrático `x² - r·x - s`.
3. **Tolerancia εs (%)** (se exige que `|Δr/r|·100` y `|Δs/s|·100` bajen de ella)
   y **máximo de iteraciones**.

La tabla tiene una fila por iteración de cada factor cuadrático: `r`, `s`,
`Δr`, `Δs`, `εr (%)` y `εs (%)`. Cuando un factor converge se obtienen dos
raíces, el polinomio se reduce (cociente de la división sintética) y se
repite hasta llegar a grado 2 (fórmula cuadrática) o grado 1. El resumen
lista cada factor con sus raíces y, al final, todas las raíces del polinomio.

### Cómo escribir funciones

| Quiero | Escribo |
|---|---|
| Potencia | `x^3` o `x**3` |
| Producto | `13*x` o `13x` |
| Exponencial | `exp(-x)` |
| Logaritmo natural | `log(x)` o `ln(x)` |
| Raíz cuadrada | `sqrt(x)` |
| Trigonométricas | `sin(x)` (o `sen(x)`), `cos(x)`, `tan(x)` |
| Constantes | `pi`, `e` |

## 4. Modo consola (sistemas lineales)

```bash
python interactivo.py
```

Pregunta, en orden: el tamaño n, la matriz A fila por fila, el vector b, x0
(Enter = ceros), la tolerancia (Enter = 1e-6), el máximo de iteraciones
(Enter = 100) y el método (`1` Jacobi, `2` Gauss-Seidel, `3` ambos).

```
¿Cuántas variables/ecuaciones tiene el sistema? 3

Ingresa la matriz A (3x3), fila por fila, valores separados por espacio:
  Fila 1: 20 1 -1
  Fila 2: 3 20 1
  Fila 3: 2 -3 20

Ingresa el vector b (3 valores separados por espacio):
  b: 17 -18 25
```

**Nota:** si algún elemento de la diagonal de A es 0, el programa te avisa
y te pide reordenar las filas: dividir entre 0 rompería el método.

## 5. Ejemplos fijos (sin ingresar nada)

```bash
python ejemplo.py
```

```bash
python ejemplo_raices.py
```

El segundo imprime, con sus tablas de iteraciones, el Ejemplo 6.3
(Newton-Raphson, `f(x) = e^-x - x`), el Ejemplo 7.2 (Müller,
`f(x) = x³ - 13x - 12`) y el Ejemplo 7.3 (Bairstow, polinomio de grado 5 con
`r = s = -1` y `εs = 1 %`) de Chapra & Canale.

## 6. Ejecutar las pruebas unitarias

```bash
python -m unittest discover -s tests
```

Debe terminar con `OK`. Las pruebas verifican que Jacobi y Gauss-Seidel
llegan a la solución correcta, y que Newton-Raphson, Müller y Bairstow
reproducen los valores de los ejemplos del libro (incluida la primera
iteración de Bairstow: `Δr = 0.3558`, `Δs = 1.1381`).

## 7. Problemas comunes

| Problema | Causa probable | Solución |
|---|---|---|
| `ModuleNotFoundError: No module named 'numpy'` | No instalaste las dependencias | Corre `pip install -r requirements.txt` |
| `ModuleNotFoundError: No module named 'tkinter'` | Tu Python no trae Tkinter (común en Linux) | Instala el paquete `python3-tk` (Debian/Ubuntu: `sudo apt install python3-tk`) |
| "tiene un 0 en la diagonal" | Alguna ecuación quedó con `a_ii = 0` | Reordena las filas para que ningún elemento de la diagonal sea 0 |
| "NO convergió" (Jacobi/GS) | La matriz no es diagonalmente dominante | Sube el máximo de iteraciones o revisa que el sistema tenga solución única |
| "Nombre desconocido en la expresión" | Escribiste una función que no existe (p. ej. `cosx` sin paréntesis) | Revisa la tabla *Cómo escribir funciones* |
| `f'(x) = 0` en Newton-Raphson | El valor inicial cae en un punto de pendiente cero | Cambia `x0` |
| "Los tres puntos iniciales deben ser distintos" (Müller) | Dos de `x0, x1, x2` son iguales | Usa tres valores distintos |
| "El sistema para Δr y Δs es singular" (Bairstow) | Los `r, s` iniciales hacen singular el sistema | Cambia `r` y `s` iniciales (p. ej. `-1, -1`) |

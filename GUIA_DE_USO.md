# Guía de uso

Guía práctica para instalar y ejecutar el proyecto **Jacobi y Gauss-Seidel**.
Si solo quieres los pasos mínimos para correrlo, ve directo a la
[sección 2](#2-instalación).

## 1. ¿Qué archivo uso?

| Quiero... | Archivo a ejecutar |
|---|---|
| Ingresar mi propio sistema de ecuaciones por teclado | `interactivo.py` |
| Ver un ejemplo ya resuelto (sistema fijo 3×3) | `ejemplo.py` |
| Verificar que el código funciona correctamente | `tests/test_metodos.py` |

## 2. Instalación

Necesitas Python 3.9 o superior instalado.

```bash
cd metodos-jacobi-gauss-seidel

# (Opcional pero recomendado) crear un entorno virtual
python -m venv .venv
source .venv/bin/activate      # En Windows: .venv\Scripts\activate

# Instalar la única dependencia (numpy)
pip install -r requirements.txt
```

## 3. Modo interactivo (ingresar tus propias variables)

```bash
python interactivo.py
```

El programa te va a preguntar, en este orden:

1. **Cantidad de variables/ecuaciones** (n). Ej: `3` para un sistema 3×3.
2. **La matriz A**, fila por fila, con los valores separados por espacio.
3. **El vector b**, con los n valores separados por espacio.
4. **Vector inicial x0** (opcional): presiona Enter para usar ceros, o
   escribe `s` para ingresarlo tú.
5. **Tolerancia** (opcional): presiona Enter para usar `1e-6` por defecto.
6. **Número máximo de iteraciones** (opcional): Enter para usar `100`.
7. **Qué método usar**: `1` Jacobi, `2` Gauss-Seidel, `3` ambos (para comparar).

### Ejemplo de sesión completa

```
¿Cuántas variables/ecuaciones tiene el sistema? 3

Ingresa la matriz A (3x3), fila por fila, valores separados por espacio:
  Fila 1: 20 1 -1
  Fila 2: 3 20 1
  Fila 3: 2 -3 20

Ingresa el vector b (3 valores separados por espacio):
  b: 17 -18 25

¿La matriz es diagonalmente dominante? Sí

¿Vector inicial x0? (Enter = ceros, o 's' para ingresarlo): 

Tolerancia (Enter = 1e-6): 
Número máximo de iteraciones (Enter = 100): 

¿Qué método quieres usar?
  1. Jacobi
  2. Gauss-Seidel
  3. Ambos (para comparar)
Opción: 3
```

Y el programa imprime la tabla de iteraciones y la solución de cada método
que hayas elegido.

**Nota:** si algún elemento de la diagonal de A es 0, el programa te avisa
y te pide reordenar las filas — dividir entre 0 rompería el método.

## 4. Ejemplo fijo (sin ingresar nada)

```bash
python ejemplo.py
```

Corre siempre el mismo sistema 3×3 (el usado en la guía de clase): 6
iteraciones de Jacobi y Gauss-Seidel hasta converger, más la solución
exacta calculada con `numpy.linalg.solve` para comparar.

## 5. Ejecutar las pruebas unitarias

```bash
python -m unittest discover -s tests
```

Debe terminar con `OK`. Estas pruebas verifican que ambos métodos llegan
a la solución correcta y que Gauss-Seidel converge en menos (o igual)
iteraciones que Jacobi.

## 6. Problemas comunes

| Problema | Causa probable | Solución |
|---|---|---|
| `ModuleNotFoundError: No module named 'numpy'` | No instalaste las dependencias | Corre `pip install -r requirements.txt` |
| El programa dice "tiene un 0 en la diagonal" | Alguna ecuación quedó con `a_ii = 0` | Reordena las filas de tu sistema para que ningún elemento de la diagonal sea 0 |
| "NO convergió" | La matriz no es diagonalmente dominante y con ese `x0`/tolerancia no alcanza a estabilizarse | Sube el número máximo de iteraciones, o revisa que el sistema tenga solución única |
| `Se esperaban N valores, ingresaste M` | Escribiste de más o de menos números en una fila | Vuelve a escribir la fila con exactamente N valores separados por espacio |

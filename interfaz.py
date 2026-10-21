"""
Interfaz gráfica (Tkinter) para los métodos numéricos del proyecto:

    * Jacobi / Gauss-Seidel  -> sistemas de ecuaciones lineales Ax = b
    * Newton-Raphson         -> raíces de f(x) = 0
    * Müller                 -> raíces (reales o complejas) de f(x) = 0
    * Bairstow               -> todas las raíces de un polinomio

Ejecutar con:  python interfaz.py
"""

import tkinter as tk
from tkinter import messagebox, ttk

from metodos_iterativos import es_diagonalmente_dominante, gauss_seidel, jacobi
from metodos_raices import (
    bairstow,
    crear_funcion,
    derivada_simbolica,
    formatear_numero,
    muller,
    newton_raphson,
    polinomio_a_texto,
)
from procedimiento import (
    procedimiento_bairstow,
    procedimiento_muller,
    procedimiento_newton,
    procedimiento_sistema,
)

FUENTE_MONO = ("Menlo", 11)


# ---------------------------------------------------------------------------
# Widgets de apoyo
# ---------------------------------------------------------------------------

def campo(parent, etiqueta, fila, valor="", ancho=28):
    """Crea Label + Entry en una grilla y devuelve la StringVar asociada."""
    ttk.Label(parent, text=etiqueta).grid(row=fila, column=0, sticky="w", padx=(0, 8), pady=3)
    var = tk.StringVar(value=valor)
    ttk.Entry(parent, textvariable=var, width=ancho).grid(row=fila, column=1, sticky="ew", pady=3)
    return var


def crear_tabla(parent, columnas, alto=12):
    """Treeview con scroll vertical/horizontal. Devuelve el Treeview."""
    marco = ttk.Frame(parent)
    marco.pack(fill="both", expand=True)
    tabla = ttk.Treeview(marco, columns=columnas, show="headings", height=alto)
    for col in columnas:
        tabla.heading(col, text=col)
        tabla.column(col, width=130, anchor="e", stretch=True)
    sy = ttk.Scrollbar(marco, orient="vertical", command=tabla.yview)
    sx = ttk.Scrollbar(marco, orient="horizontal", command=tabla.xview)
    tabla.configure(yscrollcommand=sy.set, xscrollcommand=sx.set)
    tabla.grid(row=0, column=0, sticky="nsew")
    sy.grid(row=0, column=1, sticky="ns")
    sx.grid(row=1, column=0, sticky="ew")
    marco.rowconfigure(0, weight=1)
    marco.columnconfigure(0, weight=1)
    return tabla


def llenar_tabla(tabla, columnas, filas):
    """Reemplaza las columnas y filas de un Treeview."""
    tabla.delete(*tabla.get_children())
    tabla["columns"] = columnas
    for col in columnas:
        tabla.heading(col, text=col)
        tabla.column(col, width=max(90, 11 * len(col) + 40), anchor="e", stretch=True)
    for fila in filas:
        tabla.insert("", "end", values=fila)


def leer_float(var, nombre):
    texto = var.get().strip().replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        raise ValueError(f"'{nombre}' debe ser un número (recibí: {texto!r}).")


def leer_int(var, nombre, minimo=1):
    texto = var.get().strip()
    try:
        valor = int(texto)
    except ValueError:
        raise ValueError(f"'{nombre}' debe ser un entero (recibí: {texto!r}).")
    if valor < minimo:
        raise ValueError(f"'{nombre}' debe ser mayor o igual a {minimo}.")
    return valor


def leer_lista(texto, nombre):
    partes = texto.replace(",", " ").split()
    if not partes:
        raise ValueError(f"'{nombre}' está vacío.")
    try:
        return [float(p) for p in partes]
    except ValueError:
        raise ValueError(f"'{nombre}' debe contener solo números separados por espacio.")


class Resumen(ttk.Frame):
    """Cuadro de texto de solo lectura para mostrar la conclusión de cada método."""

    def __init__(self, parent, alto=6):
        super().__init__(parent)
        self.texto = tk.Text(self, height=alto, wrap="word", font=FUENTE_MONO,
                             relief="flat", background="#f4f4f4")
        self.texto.pack(fill="both", expand=True)
        self.texto.configure(state="disabled")

    def mostrar(self, contenido):
        self.texto.configure(state="normal")
        self.texto.delete("1.0", "end")
        self.texto.insert("1.0", contenido)
        self.texto.configure(state="disabled")


class AreaProcedimiento(ttk.Frame):
    """Texto desplazable con el procedimiento paso a paso y un botón para copiarlo."""

    def __init__(self, parent):
        super().__init__(parent, padding=6)
        barra = ttk.Frame(self)
        barra.pack(fill="x", pady=(0, 4))
        ttk.Label(barra, text="Cada número se obtiene con la fórmula sustituida. "
                              "Presiona Resolver para generarlo.", foreground="#555").pack(side="left")
        ttk.Button(barra, text="Copiar", command=self.copiar).pack(side="right")

        marco = ttk.Frame(self)
        marco.pack(fill="both", expand=True)
        self.texto = tk.Text(marco, wrap="none", font=FUENTE_MONO, relief="flat",
                             background="#fbfbfb", padx=8, pady=6)
        sy = ttk.Scrollbar(marco, orient="vertical", command=self.texto.yview)
        sx = ttk.Scrollbar(marco, orient="horizontal", command=self.texto.xview)
        self.texto.configure(yscrollcommand=sy.set, xscrollcommand=sx.set)
        self.texto.grid(row=0, column=0, sticky="nsew")
        sy.grid(row=0, column=1, sticky="ns")
        sx.grid(row=1, column=0, sticky="ew")
        marco.rowconfigure(0, weight=1)
        marco.columnconfigure(0, weight=1)
        self.texto.configure(state="disabled")

    def mostrar(self, contenido):
        self.texto.configure(state="normal")
        self.texto.delete("1.0", "end")
        self.texto.insert("1.0", contenido)
        self.texto.configure(state="disabled")

    def copiar(self):
        contenido = self.texto.get("1.0", "end").strip()
        if contenido:
            self.clipboard_clear()
            self.clipboard_append(contenido)


def crear_area_resultados(parent, titulo_tabla="Tabla de iteraciones"):
    """
    Cuaderno de resultados con dos pestañas: la tabla (devuelta como frame para
    que cada pestaña ponga su Treeview y resumen) y el procedimiento paso a paso.
    Devuelve (cuaderno, frame_tabla, area_procedimiento).
    """
    cuaderno = ttk.Notebook(parent)
    frame_tabla = ttk.Frame(cuaderno, padding=6)
    cuaderno.add(frame_tabla, text=f"  {titulo_tabla}  ")
    area = AreaProcedimiento(cuaderno)
    cuaderno.add(area, text="  Procedimiento paso a paso  ")
    return cuaderno, frame_tabla, area


# ---------------------------------------------------------------------------
# Pestaña: Jacobi / Gauss-Seidel
# ---------------------------------------------------------------------------

class PestanaSistemas(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent, padding=10)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        panel = ttk.LabelFrame(self, text="Sistema Ax = b", padding=10)
        panel.grid(row=0, column=0, sticky="nsw", padx=(0, 10))
        panel.columnconfigure(1, weight=1)

        ttk.Label(panel, text="Matriz A (una fila por línea):").grid(row=0, column=0, columnspan=2, sticky="w")
        self.texto_a = tk.Text(panel, width=30, height=6, font=FUENTE_MONO)
        self.texto_a.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(2, 8))

        self.var_b = campo(panel, "Vector b:", 2)
        self.var_x0 = campo(panel, "x0 (vacío = ceros):", 3)
        self.var_tol = campo(panel, "Tolerancia:", 4, "1e-6")
        self.var_iter = campo(panel, "Máx. iteraciones:", 5, "100")

        ttk.Label(panel, text="Método:").grid(row=6, column=0, sticky="w", pady=(8, 0))
        self.var_metodo = tk.StringVar(value="ambos")
        marco_radios = ttk.Frame(panel)
        marco_radios.grid(row=6, column=1, sticky="w", pady=(8, 0))
        for texto, valor in (("Jacobi", "jacobi"), ("Gauss-Seidel", "gs"), ("Ambos", "ambos")):
            ttk.Radiobutton(marco_radios, text=texto, value=valor, variable=self.var_metodo).pack(anchor="w")

        botones = ttk.Frame(panel)
        botones.grid(row=7, column=0, columnspan=2, pady=(12, 0), sticky="ew")
        ttk.Button(botones, text="Cargar ejemplo", command=self.cargar_ejemplo).pack(side="left")
        ttk.Button(botones, text="Resolver", command=self.resolver).pack(side="right")

        cuaderno, resultados, self.procedimiento = crear_area_resultados(self, "Tablas de iteraciones")
        cuaderno.grid(row=0, column=1, sticky="nsew")
        resultados.rowconfigure(0, weight=1)
        resultados.rowconfigure(1, weight=1)
        resultados.columnconfigure(0, weight=1)

        self.marco_jacobi = ttk.LabelFrame(resultados, text="Jacobi", padding=6)
        self.tabla_jacobi = crear_tabla(self.marco_jacobi, ("k",), alto=7)
        self.resumen_jacobi = Resumen(self.marco_jacobi, alto=3)
        self.resumen_jacobi.pack(fill="x", pady=(6, 0))

        self.marco_gs = ttk.LabelFrame(resultados, text="Gauss-Seidel", padding=6)
        self.tabla_gs = crear_tabla(self.marco_gs, ("k",), alto=7)
        self.resumen_gs = Resumen(self.marco_gs, alto=3)
        self.resumen_gs.pack(fill="x", pady=(6, 0))

        self.marco_jacobi.grid(row=0, column=0, sticky="nsew", pady=(0, 6))
        self.marco_gs.grid(row=1, column=0, sticky="nsew")
        self.cargar_ejemplo()

    def cargar_ejemplo(self):
        self.texto_a.delete("1.0", "end")
        self.texto_a.insert("1.0", "20 1 -1\n3 20 1\n2 -3 20")
        self.var_b.set("17 -18 25")
        self.var_x0.set("")
        self.var_tol.set("1e-6")
        self.var_iter.set("100")

    def leer_sistema(self):
        lineas = [l for l in self.texto_a.get("1.0", "end").strip().splitlines() if l.strip()]
        if not lineas:
            raise ValueError("Ingresa la matriz A.")
        A = [leer_lista(l, f"Fila {i + 1} de A") for i, l in enumerate(lineas)]
        n = len(A)
        for i, fila in enumerate(A):
            if len(fila) != n:
                raise ValueError(f"La fila {i + 1} de A tiene {len(fila)} valores; se esperaban {n} (matriz cuadrada).")
            if fila[i] == 0:
                raise ValueError(f"La fila {i + 1} tiene un 0 en la diagonal: reordena las ecuaciones.")
        b = leer_lista(self.var_b.get(), "Vector b")
        if len(b) != n:
            raise ValueError(f"El vector b tiene {len(b)} valores; se esperaban {n}.")
        x0 = None
        if self.var_x0.get().strip():
            x0 = leer_lista(self.var_x0.get(), "x0")
            if len(x0) != n:
                raise ValueError(f"x0 tiene {len(x0)} valores; se esperaban {n}.")
        return A, b, x0

    def mostrar(self, tabla, resumen, resultado, dominante):
        n = len(resultado["x"])
        columnas = ("k",) + tuple(f"x{i + 1}" for i in range(n)) + ("error",)
        filas = []
        historial = resultado["historial"]
        for k, x in enumerate(historial):
            error = "" if k == 0 else formatear_numero(max(abs(a - b) for a, b in zip(x, historial[k - 1])), 8)
            filas.append((k,) + tuple(formatear_numero(v) for v in x) + (error,))
        llenar_tabla(tabla, columnas, filas)
        estado = "Convergió" if resultado["convergio"] else "NO convergió (máximo de iteraciones)"
        solucion = "  ".join(f"x{i + 1} = {formatear_numero(v)}" for i, v in enumerate(resultado["x"]))
        resumen.mostrar(
            f"{estado} en {resultado['iteraciones']} iteraciones.\n{solucion}\n"
            f"Diagonalmente dominante: {'Sí' if dominante else 'No (convergencia no garantizada)'}"
        )

    def resolver(self):
        try:
            A, b, x0 = self.leer_sistema()
            tol = leer_float(self.var_tol, "Tolerancia")
            max_iter = leer_int(self.var_iter, "Máx. iteraciones")
        except ValueError as exc:
            messagebox.showerror("Datos inválidos", str(exc))
            return

        dominante = es_diagonalmente_dominante(A)
        metodo = self.var_metodo.get()
        self.marco_jacobi.grid_remove()
        self.marco_gs.grid_remove()
        textos = []
        if metodo in ("jacobi", "ambos"):
            self.marco_jacobi.grid()
            resultado = jacobi(A, b, x0=x0, tol=tol, max_iter=max_iter)
            self.mostrar(self.tabla_jacobi, self.resumen_jacobi, resultado, dominante)
            textos.append(procedimiento_sistema("Jacobi", A, b, resultado, tol))
        if metodo in ("gs", "ambos"):
            self.marco_gs.grid()
            resultado = gauss_seidel(A, b, x0=x0, tol=tol, max_iter=max_iter)
            self.mostrar(self.tabla_gs, self.resumen_gs, resultado, dominante)
            textos.append(procedimiento_sistema("Gauss-Seidel", A, b, resultado, tol))
        self.procedimiento.mostrar("\n\n\n".join(textos))


# ---------------------------------------------------------------------------
# Pestaña: Newton-Raphson
# ---------------------------------------------------------------------------

AYUDA_FUNCIONES = (
    "Escribe f(x) usando x. Potencia: ^ o **. Funciones: sin, cos, tan, exp,\n"
    "log (ln), log10, sqrt, abs; constantes pi, e.  Ej: exp(-x) - x"
)


class PestanaNewton(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent, padding=10)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        panel = ttk.LabelFrame(self, text="Newton-Raphson", padding=10)
        panel.grid(row=0, column=0, sticky="nsw", padx=(0, 10))
        panel.columnconfigure(1, weight=1)

        self.var_f = campo(panel, "f(x) =", 0, "exp(-x) - x", ancho=32)
        self.var_df = campo(panel, "f'(x) = (opcional)", 1, "", ancho=32)
        ttk.Label(panel, text="Si f'(x) se deja vacío se deriva automáticamente.",
                  foreground="#555").grid(row=2, column=0, columnspan=2, sticky="w")
        self.var_x0 = campo(panel, "x0:", 3, "0")
        self.var_tol = campo(panel, "Tolerancia εs (%):", 4, "0.0001")
        self.var_iter = campo(panel, "Máx. iteraciones:", 5, "100")
        ttk.Label(panel, text=AYUDA_FUNCIONES, foreground="#555", justify="left").grid(
            row=6, column=0, columnspan=2, sticky="w", pady=(10, 0))

        botones = ttk.Frame(panel)
        botones.grid(row=7, column=0, columnspan=2, pady=(12, 0), sticky="ew")
        ttk.Button(botones, text="Cargar ejemplo", command=self.cargar_ejemplo).pack(side="left")
        ttk.Button(botones, text="Resolver", command=self.resolver).pack(side="right")

        cuaderno, resultados, self.procedimiento = crear_area_resultados(self)
        cuaderno.grid(row=0, column=1, sticky="nsew")
        self.tabla = crear_tabla(resultados, ("i", "x_i", "f(x_i)", "f'(x_i)", "x_i+1", "εa (%)"))
        self.resumen = Resumen(resultados, alto=5)
        self.resumen.pack(fill="x", pady=(6, 0))

    def cargar_ejemplo(self):
        # Ejemplo 6.3 de Chapra & Canale
        self.var_f.set("exp(-x) - x")
        self.var_df.set("")
        self.var_x0.set("0")
        self.var_tol.set("0.0001")
        self.var_iter.set("100")

    def resolver(self):
        try:
            f = crear_funcion(self.var_f.get())
            x0 = leer_float(self.var_x0, "x0")
            tol = leer_float(self.var_tol, "Tolerancia")
            max_iter = leer_int(self.var_iter, "Máx. iteraciones")
            texto_df = self.var_df.get().strip()
            if texto_df:
                df, origen = crear_funcion(texto_df), f"f'(x) = {texto_df} (ingresada)"
                expr_df = texto_df
            else:
                df, texto_derivada = derivada_simbolica(self.var_f.get())
                origen = (f"f'(x) = {texto_derivada} (derivada simbólica)" if df
                          else "f'(x) por diferencias centrales (derivada numérica)")
                expr_df = texto_derivada if df else "(derivada numérica por diferencias centrales)"
            resultado = newton_raphson(f, x0, df=df, tol=tol, max_iter=max_iter)
        except (ValueError, ZeroDivisionError, OverflowError) as exc:
            messagebox.showerror("Error", str(exc))
            return

        filas = [(h["i"], formatear_numero(h["x"], 8), formatear_numero(h["fx"], 8),
                  formatear_numero(h["dfx"], 8), formatear_numero(h["x_nuevo"], 8),
                  formatear_numero(h["error"], 6)) for h in resultado["historial"]]
        llenar_tabla(self.tabla, ("i", "x_i", "f(x_i)", "f'(x_i)", "x_i+1", "εa (%)"), filas)
        estado = "Convergió" if resultado["convergio"] else "NO convergió (máximo de iteraciones)"
        self.resumen.mostrar(
            f"{origen}\n{estado} en {resultado['iteraciones']} iteraciones.\n"
            f"Raíz ≈ {formatear_numero(resultado['raiz'], 8)}    "
            f"f(raíz) = {formatear_numero(resultado['f_raiz'], 10)}"
        )
        self.procedimiento.mostrar(procedimiento_newton(self.var_f.get().strip(), expr_df, resultado, tol))


# ---------------------------------------------------------------------------
# Pestaña: Müller
# ---------------------------------------------------------------------------

class PestanaMuller(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent, padding=10)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        panel = ttk.LabelFrame(self, text="Müller", padding=10)
        panel.grid(row=0, column=0, sticky="nsw", padx=(0, 10))
        panel.columnconfigure(1, weight=1)

        self.var_f = campo(panel, "f(x) =", 0, "x^3 - 13x - 12", ancho=32)
        self.var_x0 = campo(panel, "x0:", 1, "4.5")
        self.var_x1 = campo(panel, "x1:", 2, "5.5")
        self.var_x2 = campo(panel, "x2:", 3, "5")
        self.var_tol = campo(panel, "Tolerancia εs (%):", 4, "0.0001")
        self.var_iter = campo(panel, "Máx. iteraciones:", 5, "100")
        ttk.Label(panel, text=AYUDA_FUNCIONES + "\nPuede encontrar raíces complejas.",
                  foreground="#555", justify="left").grid(row=6, column=0, columnspan=2, sticky="w", pady=(10, 0))

        botones = ttk.Frame(panel)
        botones.grid(row=7, column=0, columnspan=2, pady=(12, 0), sticky="ew")
        ttk.Button(botones, text="Cargar ejemplo", command=self.cargar_ejemplo).pack(side="left")
        ttk.Button(botones, text="Resolver", command=self.resolver).pack(side="right")

        cuaderno, resultados, self.procedimiento = crear_area_resultados(self)
        cuaderno.grid(row=0, column=1, sticky="nsew")
        self.tabla = crear_tabla(resultados, ("i", "x0", "x1", "x2", "x3", "εa (%)"))
        self.resumen = Resumen(resultados, alto=4)
        self.resumen.pack(fill="x", pady=(6, 0))

    def cargar_ejemplo(self):
        # Ejemplo 7.2 de Chapra & Canale
        self.var_f.set("x^3 - 13x - 12")
        self.var_x0.set("4.5")
        self.var_x1.set("5.5")
        self.var_x2.set("5")
        self.var_tol.set("0.0001")
        self.var_iter.set("100")

    def resolver(self):
        try:
            f = crear_funcion(self.var_f.get())
            x0 = leer_float(self.var_x0, "x0")
            x1 = leer_float(self.var_x1, "x1")
            x2 = leer_float(self.var_x2, "x2")
            tol = leer_float(self.var_tol, "Tolerancia")
            max_iter = leer_int(self.var_iter, "Máx. iteraciones")
            resultado = muller(f, x0, x1, x2, tol=tol, max_iter=max_iter)
        except (ValueError, ZeroDivisionError, OverflowError) as exc:
            messagebox.showerror("Error", str(exc))
            return

        filas = [(h["i"], formatear_numero(h["x0"]), formatear_numero(h["x1"]),
                  formatear_numero(h["x2"]), formatear_numero(h["x3"]),
                  formatear_numero(h["error"], 6)) for h in resultado["historial"]]
        llenar_tabla(self.tabla, ("i", "x0", "x1", "x2", "x3", "εa (%)"), filas)
        estado = "Convergió" if resultado["convergio"] else "NO convergió (máximo de iteraciones)"
        tipo = "compleja" if isinstance(resultado["raiz"], complex) else "real"
        self.resumen.mostrar(
            f"{estado} en {resultado['iteraciones']} iteraciones.\n"
            f"Raíz ({tipo}) ≈ {formatear_numero(resultado['raiz'], 8)}\n"
            f"f(raíz) = {formatear_numero(resultado['f_raiz'], 10)}"
        )
        self.procedimiento.mostrar(procedimiento_muller(self.var_f.get().strip(), resultado, tol))


# ---------------------------------------------------------------------------
# Pestaña: Bairstow
# ---------------------------------------------------------------------------

class PestanaBairstow(ttk.Frame):
    COLUMNAS = ("Factor", "i", "r", "s", "Δr", "Δs", "εr (%)", "εs (%)")

    def __init__(self, parent):
        super().__init__(parent, padding=10)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        panel = ttk.LabelFrame(self, text="Bairstow", padding=10)
        panel.grid(row=0, column=0, sticky="nsw", padx=(0, 10))
        panel.columnconfigure(1, weight=1)

        self.var_coefs = campo(panel, "Coeficientes:", 0, "1 -3.5 2.75 2.125 -3.875 1.25", ancho=32)
        ttk.Label(panel, text="Del grado mayor al menor, separados por espacio.\n"
                              "Ej: x^2 - 3x + 2  ->  1 -3 2",
                  foreground="#555", justify="left").grid(row=1, column=0, columnspan=2, sticky="w")
        self.etiqueta_poli = ttk.Label(panel, text="", font=FUENTE_MONO)
        self.etiqueta_poli.grid(row=2, column=0, columnspan=2, sticky="w", pady=(4, 8))
        self.var_coefs.trace_add("write", lambda *_: self.actualizar_polinomio())

        self.var_r = campo(panel, "r inicial:", 3, "-1")
        self.var_s = campo(panel, "s inicial:", 4, "-1")
        self.var_tol = campo(panel, "Tolerancia εs (%):", 5, "1")
        self.var_iter = campo(panel, "Máx. iteraciones:", 6, "100")

        botones = ttk.Frame(panel)
        botones.grid(row=7, column=0, columnspan=2, pady=(12, 0), sticky="ew")
        ttk.Button(botones, text="Cargar ejemplo", command=self.cargar_ejemplo).pack(side="left")
        ttk.Button(botones, text="Resolver", command=self.resolver).pack(side="right")

        cuaderno, resultados, self.procedimiento = crear_area_resultados(
            self, "Iteraciones por factor cuadrático x² - r x - s")
        cuaderno.grid(row=0, column=1, sticky="nsew")
        self.tabla = crear_tabla(resultados, self.COLUMNAS)
        self.resumen = Resumen(resultados, alto=8)
        self.resumen.pack(fill="x", pady=(6, 0))
        self.actualizar_polinomio()

    def actualizar_polinomio(self):
        try:
            coefs = leer_lista(self.var_coefs.get(), "Coeficientes")
            self.etiqueta_poli.configure(text="f(x) = " + polinomio_a_texto(coefs))
        except ValueError:
            self.etiqueta_poli.configure(text="f(x) = ?")

    def cargar_ejemplo(self):
        # Ejemplo 7.3 de Chapra & Canale
        self.var_coefs.set("1 -3.5 2.75 2.125 -3.875 1.25")
        self.var_r.set("-1")
        self.var_s.set("-1")
        self.var_tol.set("1")
        self.var_iter.set("100")

    def resolver(self):
        try:
            coefs = leer_lista(self.var_coefs.get(), "Coeficientes")
            r = leer_float(self.var_r, "r inicial")
            s = leer_float(self.var_s, "s inicial")
            tol = leer_float(self.var_tol, "Tolerancia")
            max_iter = leer_int(self.var_iter, "Máx. iteraciones")
            resultado = bairstow(coefs, r=r, s=s, tol=tol, max_iter=max_iter)
        except (ValueError, ZeroDivisionError, OverflowError) as exc:
            messagebox.showerror("Error", str(exc))
            return

        filas = []
        lineas = [f"f(x) = {polinomio_a_texto(resultado['polinomio'])}", ""]
        for num, factor in enumerate(resultado["factores"], 1):
            for h in factor["historial"]:
                filas.append((f"{num} (grado {factor['grado']})", h["i"], formatear_numero(h["r"]),
                              formatear_numero(h["s"]), formatear_numero(h["delta_r"]),
                              formatear_numero(h["delta_s"]), formatear_numero(h["error_r"], 4),
                              formatear_numero(h["error_s"], 4)))
            x1, x2 = factor["raices"]
            if factor["historial"]:
                estado = (f"convergió en {factor['iteraciones']} iter." if factor["convergio"]
                          else f"NO convergió ({factor['iteraciones']} iter.)")
            else:
                estado = "resuelto directamente (cuadrática)"
            lineas.append(
                f"Factor {num}: x² - ({formatear_numero(factor['r'], 4)})x - ({formatear_numero(factor['s'], 4)})"
                f"  [{estado}]\n    raíces: {formatear_numero(x1)}   {formatear_numero(x2)}"
            )
        llenar_tabla(self.tabla, self.COLUMNAS, filas)

        lineas.append("")
        lineas.append("Raíces del polinomio:")
        for i, raiz in enumerate(resultado["raices"], 1):
            lineas.append(f"  x{i} = {formatear_numero(raiz)}")
        if not resultado["convergio"]:
            lineas.append("\n⚠ Algún factor no convergió: prueba otros r, s o más iteraciones.")
        self.resumen.mostrar("\n".join(lineas))
        self.procedimiento.mostrar(procedimiento_bairstow(resultado, tol))


# ---------------------------------------------------------------------------
# Ventana principal
# ---------------------------------------------------------------------------

class Aplicacion(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Métodos Numéricos — Jacobi, Gauss-Seidel, Newton-Raphson, Müller y Bairstow")
        self.geometry("1150x680")
        self.minsize(900, 560)

        cuaderno = ttk.Notebook(self)
        cuaderno.pack(fill="both", expand=True, padx=8, pady=8)
        cuaderno.add(PestanaSistemas(cuaderno), text="  Jacobi / Gauss-Seidel  ")
        cuaderno.add(PestanaNewton(cuaderno), text="  Newton-Raphson  ")
        cuaderno.add(PestanaMuller(cuaderno), text="  Müller  ")
        cuaderno.add(PestanaBairstow(cuaderno), text="  Bairstow  ")


def main():
    Aplicacion().mainloop()


if __name__ == "__main__":
    main()

import math
from pathlib import Path
import joblib
import pandas as pd
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

from conexion import obtener_conexion

BASE_DIR = Path(__file__).resolve().parent
RUTA_MODELO = BASE_DIR / "cerebro_diabetes.joblib"

app = Flask(__name__)
CORS(app)

# Limitar tamano maximo del payload HTTP a 32 KB para mitigar ataques DoS
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024

# Cargar el modelo de Machine Learning entrenado
if not RUTA_MODELO.exists():
    raise FileNotFoundError(
        f"El modelo no existe en {RUTA_MODELO}. Ejecuta entrenar.py primero."
    )

modelo = joblib.load(RUTA_MODELO)

# ==============================================================
# DEFINICION ESTRICTA DE LIMITES CLINICOS Y BIOMARCADORES (OMS/ADA)
# ==============================================================
REGLAS_BIOMARCADORES = {
    "embarazos": {
        "nombre": "Número de Embarazos",
        "min": 0,
        "max": 25,
        "es_entero": True,
        "unidad": "gestaciones",
        "rango_esperado": "0 a 25 gestaciones",
    },
    "glucosa": {
        "nombre": "Glucosa Plasmática",
        "min": 30.0,
        "max": 600.0,
        "es_entero": False,
        "unidad": "mg/dL",
        "rango_esperado": "30 a 600 mg/dL",
    },
    "presion_arterial": {
        "nombre": "Presión Arterial Diastólica",
        "min": 30.0,
        "max": 180.0,
        "es_entero": False,
        "unidad": "mmHg",
        "rango_esperado": "30 a 180 mmHg",
    },
    "grosor_piel": {
        "nombre": "Pliegue Cutáneo (Tríceps)",
        "min": 2.0,
        "max": 99.0,
        "es_entero": False,
        "unidad": "mm",
        "rango_esperado": "2 a 99 mm",
    },
    "insulina": {
        "nombre": "Insulina Sérica (2h)",
        "min": 0.0,
        "max": 850.0,
        "es_entero": False,
        "unidad": "μU/mL",
        "rango_esperado": "0 a 850 μU/mL",
    },
    "imc": {
        "nombre": "Índice de Masa Corporal (IMC)",
        "min": 10.0,
        "max": 80.0,
        "es_entero": False,
        "unidad": "kg/m²",
        "rango_esperado": "10.0 a 80.0 kg/m²",
    },
    "pedigri_diabetes": {
        "nombre": "Función de Pedigrí Genético",
        "min": 0.05,
        "max": 2.50,
        "es_entero": False,
        "unidad": "índice",
        "rango_esperado": "0.05 a 2.50",
    },
    "edad": {
        "nombre": "Edad del Paciente",
        "min": 1,
        "max": 120,
        "es_entero": True,
        "unidad": "años",
        "rango_esperado": "1 a 120 años",
    },
}

COLUMNAS_MODELO = list(REGLAS_BIOMARCADORES.keys())

PACIENTES_EJEMPLO = {
    "sano": {
        "nombre": "Paciente Sano (Control)",
        "embarazos": 1,
        "glucosa": 85,
        "presion_arterial": 66,
        "grosor_piel": 23,
        "insulina": 94,
        "imc": 22.4,
        "pedigri_diabetes": 0.167,
        "edad": 24,
    },
    "moderado": {
        "nombre": "Paciente con Alerta / Pre-diabetes",
        "embarazos": 3,
        "glucosa": 135,
        "presion_arterial": 76,
        "grosor_piel": 28,
        "insulina": 110,
        "imc": 29.8,
        "pedigri_diabetes": 0.450,
        "edad": 42,
    },
    "critico": {
        "nombre": "Paciente Diabético (Alto Riesgo)",
        "embarazos": 6,
        "glucosa": 178,
        "presion_arterial": 88,
        "grosor_piel": 38,
        "insulina": 220,
        "imc": 36.5,
        "pedigri_diabetes": 0.850,
        "edad": 54,
    },
}


def sanitizar_y_validar_paciente(datos_cliente):
    """
    Valida y sanitiza exhaustivamente los datos del paciente contra:
    1. Tipos no validos (NaN, Infinity, booleans, diccionarios, arrays).
    2. Valores nulos o campos faltantes.
    3. Limites fisiologicos y biologicos reales (OMS/ADA).
    Retorna (datos_limpios, None) o (None, mensaje_error).
    """
    if not isinstance(datos_cliente, dict):
        return None, "La solicitud debe ser un objeto JSON valido."

    datos_limpios = {}
    errores_validacion = []

    for campo, regla in REGLAS_BIOMARCADORES.items():
        if campo not in datos_cliente:
            errores_validacion.append(f"Falta el biomarcador obligatorio: '{regla['nombre']}' ({campo}).")
            continue

        valor_crudo = datos_cliente[campo]

        # Rechazar tipos peligrosos (booleans, dicts, lists, None)
        if isinstance(valor_crudo, bool) or valor_crudo is None:
            errores_validacion.append(f"El campo '{regla['nombre']}' contiene un tipo de dato no valido.")
            continue

        # Intentar conversion numerica estricta
        try:
            # Si es string, limpiamos posibles comas por puntos (error comun de usuario)
            if isinstance(valor_crudo, str):
                valor_crudo = valor_crudo.strip().replace(",", ".")

            valor_float = float(valor_crudo)
        except (ValueError, TypeError):
            errores_validacion.append(f"'{regla['nombre']}' debe ser un valor numerico valido.")
            continue

        # Mitigacion contra NaN, Infinity y -Infinity
        if math.isnan(valor_float) or math.isinf(valor_float):
            errores_validacion.append(f"El valor de '{regla['nombre']}' no puede ser infinito o indeterminado (NaN).")
            continue

        # Validar enteros si corresponde (ej. embarazos, edad)
        if regla["es_entero"]:
            # Verificar si tiene parte decimal significativa
            if not valor_float.is_integer():
                errores_validacion.append(f"'{regla['nombre']}' debe ser un numero entero sin decimales.")
                continue
            valor_final = int(valor_float)
        else:
            valor_final = round(valor_float, 4)

        # Validacion de limites fisiologicos estrictos (previene millonadas o valores negativos)
        if valor_final < regla["min"]:
            errores_validacion.append(
                f"'{regla['nombre']}' demasiado bajo: {valor_final} {regla['unidad']}. "
                f"El minimo fisiologico permitido es {regla['min']} {regla['unidad']}."
            )
            continue

        if valor_final > regla["max"]:
            errores_validacion.append(
                f"'{regla['nombre']}' excede el limite maximo plausible: {valor_final} {regla['unidad']}. "
                f"El maximo permitido es {regla['max']} {regla['unidad']} (rango: {regla['rango_esperado']})."
            )
            continue

        datos_limpios[campo] = valor_final

    if errores_validacion:
        return None, " | ".join(errores_validacion)

    return datos_limpios, None


def evaluar_factores_riesgo(datos):
    """Detecta anomalias clinicas individuales basadas en las guias de la OMS."""
    factores = []
    if datos["glucosa"] >= 140:
        factores.append(f"Glucosa muy elevada ({datos['glucosa']} mg/dL - hiperglucemia clínica)")
    elif datos["glucosa"] >= 100:
        factores.append(f"Glucosa en rango de pre-diabetes ({datos['glucosa']} mg/dL)")

    if datos["imc"] >= 30:
        factores.append(f"Obesidad marcada (IMC {datos['imc']} kg/m²)")
    elif datos["imc"] >= 25:
        factores.append(f"Sobrepeso (IMC {datos['imc']} kg/m²)")

    if datos["presion_arterial"] >= 80:
        factores.append(f"Presión arterial diastólica limítrofe/alta ({datos['presion_arterial']} mmHg)")

    if datos["grosor_piel"] >= 35:
        factores.append(f"Pliegue cutáneo elevado ({datos['grosor_piel']} mm - adiposidad periférica)")

    if datos["insulina"] >= 166:
        factores.append(f"Hiperinsulinemia sérica ({datos['insulina']} μU/mL - resistencia insulínica)")

    if datos["edad"] >= 45:
        factores.append(f"Grupo etario de mayor incidencia ({datos['edad']} años)")

    if datos["pedigri_diabetes"] >= 0.5:
        factores.append(f"Carga genética / antecedente familiar significativo ({datos['pedigri_diabetes']})")

    return factores


# ==============================================================
# ENDPOINTS DE LA API REST (ARQUITECTURA CLIENTE - SERVIDOR)
# ==============================================================


@app.route("/api/predecir", methods=["POST"])
def api_predecir():
    """Recibe la peticion JSON del cliente y devuelve el diagnostico asistido por ML."""
    datos_cliente = request.get_json(silent=True)

    if datos_cliente is None:
        return jsonify({"exito": False, "error": "Cuerpo de solicitud JSON no valido, vacio o malformado."}), 400

    # Sanitizar y validar defensivamente
    fila, error = sanitizar_y_validar_paciente(datos_cliente)
    if error:
        return jsonify({"exito": False, "error": error}), 422

    try:
        # Predecir con el modelo serializado
        df_evaluar = pd.DataFrame([fila])[COLUMNAS_MODELO]
        prediccion = int(modelo.predict(df_evaluar)[0])
        probabilidades = modelo.predict_proba(df_evaluar)[0]
        prob_diabetes = float(probabilidades[1]) * 100

        # Nivel de riesgo categorizado
        if prob_diabetes < 35:
            nivel_riesgo = "Bajo"
            color_alerta = "verde"
            diagnostico = "Perfil Compatible con Paciente No Diabético"
            recomendacion = "Mantener hábitos de vida saludables, actividad física regular y control médico anual."
        elif prob_diabetes < 65:
            nivel_riesgo = "Moderado"
            color_alerta = "ambar"
            diagnostico = "Alerta de Riesgo Moderado / Sospecha de Pre-diabetes"
            recomendacion = "Se sugiere prueba de tolerancia a la glucosa oral y hemoglobina glucosilada (HbA1c)."
        else:
            nivel_riesgo = "Alto"
            color_alerta = "rojo"
            diagnostico = "Alta Probabilidad de Diabetes Mellitus"
            recomendacion = "Requiere valoración médica inmediata con endocrinología para inicio de protocolo clínico."

        factores = evaluar_factores_riesgo(fila)

        respuesta = {
            "exito": True,
            "prediccion": prediccion,
            "es_diabetico": bool(prediccion == 1),
            "probabilidad_diabetes": round(prob_diabetes, 1),
            "probabilidad_no_diabetes": round(100 - prob_diabetes, 1),
            "nivel_riesgo": nivel_riesgo,
            "color_alerta": color_alerta,
            "diagnostico": diagnostico,
            "recomendacion": recomendacion,
            "factores_identificados": factores,
            "parametros_analizados": fila,
        }
        return jsonify(respuesta), 200

    except Exception as e:
        return jsonify({"exito": False, "error": f"Error interno en el servidor: {str(e)}"}), 500


@app.route("/api/reglas-validacion", methods=["GET"])
def api_reglas_validacion():
    """Proporciona las reglas de validacion para que los clientes las sincronicen."""
    return jsonify({"exito": True, "reglas": REGLAS_BIOMARCADORES}), 200


@app.route("/api/pacientes-muestra", methods=["GET"])
def api_pacientes_muestra():
    return jsonify({"exito": True, "pacientes": PACIENTES_EJEMPLO}), 200


@app.route("/api/estadisticas", methods=["GET"])
def api_estadisticas():
    try:
        col = obtener_conexion()
        total = col.count_documents({})
        diabeticos = col.count_documents({"resultado": 1})
        no_diabeticos = col.count_documents({"resultado": 0})
        return jsonify(
            {
                "exito": True,
                "base_datos": "diabetes_db",
                "coleccion": "pacientes",
                "total_registros": total,
                "casos_diabeticos": diabeticos,
                "casos_no_diabeticos": no_diabeticos,
                "prevalencia": round((diabeticos / total * 100), 1) if total > 0 else 0,
            }
        ), 200
    except Exception as e:
        return jsonify({"exito": False, "error": str(e)}), 500


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    print("Iniciando Servidor Seguro de Diabetes en http://127.0.0.1:5002")
    app.run(debug=True, host="0.0.0.0", port=5002)

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

# Cargar el modelo de Machine Learning entrenado
if not RUTA_MODELO.exists():
    raise FileNotFoundError(
        f"El modelo no existe en {RUTA_MODELO}. Ejecuta entrenar.py primero."
    )

modelo = joblib.load(RUTA_MODELO)

# Caracteristicas requeridas por el modelo
COLUMNAS_MODELO = [
    "embarazos",
    "glucosa",
    "presion_arterial",
    "grosor_piel",
    "insulina",
    "imc",
    "pedigri_diabetes",
    "edad",
]

# Pacientes preconfigurados para pruebas rapidas desde el cliente
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


def evaluar_factores_riesgo(datos):
    """Detecta anomalias clinicas individuales basadas en las guias de la OMS."""
    factores = []
    if datos["glucosa"] >= 140:
        factores.append(f"Glucosa muy elevada ({datos['glucosa']} mg/dL - hiperglucemia)")
    elif datos["glucosa"] >= 100:
        factores.append(f"Glucosa en rango de pre-diabetes ({datos['glucosa']} mg/dL)")

    if datos["imc"] >= 30:
        factores.append(f"Obesidad marcada (IMC {datos['imc']} kg/m²)")
    elif datos["imc"] >= 25:
        factores.append(f"Sobrepeso (IMC {datos['imc']} kg/m²)")

    if datos["presion_arterial"] >= 80:
        factores.append(f"Presión arterial diastólica limítrofe/alta ({datos['presion_arterial']} mmHg)")

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

    if not datos_cliente:
        return jsonify({"exito": False, "error": "Cuerpo de solicitud JSON no valido o vacio."}), 400

    try:
        # Validar y convertir cada parametro
        fila = {}
        for col in COLUMNAS_MODELO:
            if col not in datos_cliente:
                return jsonify({"exito": False, "error": f"Falta el parametro obligatorio: '{col}'"}), 400
            valor = float(datos_cliente[col])
            if valor < 0:
                return jsonify({"exito": False, "error": f"El valor de '{col}' no puede ser negativo."}), 400
            fila[col] = valor

        # Predecir con el modelo
        df_evaluar = pd.DataFrame([fila])[COLUMNAS_MODELO]
        prediccion = int(modelo.predict(df_evaluar)[0])
        probabilidades = modelo.predict_proba(df_evaluar)[0]
        prob_diabetes = float(probabilidades[1]) * 100

        # Nivel de riesgo categorizado
        if prob_diabetes < 35:
            nivel_riesgo = "Bajo"
            color_alerta = "verde"
            diagnostico = "Perfil Compatible con Paciente No Diabético"
            recomendacion = "Mantener habitos de vida saludables, dieta equilibrada y chequeo anual de rutina."
        elif prob_diabetes < 65:
            nivel_riesgo = "Moderado"
            color_alerta = "ambar"
            diagnostico = "Alerta de Riesgo Moderado / Sospecha de Pre-diabetes"
            recomendacion = "Se recomienda realizar prueba de hemoglobina glucosilada (HbA1c) y consulta con especialista."
        else:
            nivel_riesgo = "Alto"
            color_alerta = "rojo"
            diagnostico = "Alta Probabilidad de Diabetes Mellitus"
            recomendacion = "Requiere valoracion medica inmediata con endocrinologia y analisis de tolerancia a la glucosa."

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

    except (ValueError, TypeError) as e:
        return jsonify({"exito": False, "error": f"Error en los tipos de datos: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"exito": False, "error": f"Error interno en el servidor: {str(e)}"}), 500


@app.route("/api/pacientes-muestra", methods=["GET"])
def api_pacientes_muestra():
    """Entrega los pacientes preconfigurados al cliente."""
    return jsonify({"exito": True, "pacientes": PACIENTES_EJEMPLO}), 200


@app.route("/api/estadisticas", methods=["GET"])
def api_estadisticas():
    """Consulta MongoDB para retornar indicadores globales de la base de pacientes."""
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


# ==============================================================
# RUTA CLIENTE: VISTA WEB PARA CELULAR / NAVEGADOR
# ==============================================================


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    # Servidor REST en puerto 5002 para coexistir sin conflicto con vinos (puerto 5001)
    print("Iniciando Servidor de Prediccion de Diabetes en http://127.0.0.1:5002")
    app.run(debug=True, host="0.0.0.0", port=5002)

from pathlib import Path
import json
import joblib

BASE_DIR = Path(__file__).resolve().parent
RUTA_MODELO = BASE_DIR / "cerebro_diabetes.joblib"
RUTA_SALIDA_JS = BASE_DIR / "static" / "js" / "modelo_diabetes_exportado.js"

caracteristicas = [
    "embarazos",
    "glucosa",
    "presion_arterial",
    "grosor_piel",
    "insulina",
    "imc",
    "pedigri_diabetes",
    "edad",
]


def exportar():
    if not RUTA_MODELO.exists():
        raise FileNotFoundError(f"No existe el modelo en {RUTA_MODELO}")

    modelo = joblib.load(RUTA_MODELO)
    arboles = []

    for est in modelo.estimators_:
        t = est.tree_
        arboles.append(
            {
                "left": t.children_left.tolist(),
                "right": t.children_right.tolist(),
                "feature": t.feature.tolist(),
                "threshold": [round(float(th), 4) for th in t.threshold],
                "values": [
                    [round(float(v[0][0]), 4), round(float(v[0][1]), 4)]
                    for v in t.value
                ],
            }
        )

    datos_json = json.dumps(
        {
            "caracteristicas": caracteristicas,
            "n_arboles": len(arboles),
            "arboles": arboles,
        }
    )

    contenido_js = f"""// Modelo Random Forest exportado desde scikit-learn para ejecucion en GitHub Pages / Navegador
const MODELO_DIABETES_DATA = {datos_json};

function predecirDiabetesEnNavegador(datos) {{
  const features = MODELO_DIABETES_DATA.caracteristicas;
  const X = features.map(f => parseFloat(datos[f]) || 0);
  
  let votosClase1 = 0;
  const nArboles = MODELO_DIABETES_DATA.arboles.length;

  for (const arbol of MODELO_DIABETES_DATA.arboles) {{
    let nodo = 0;
    while (arbol.feature[nodo] !== -2) {{
      const fIdx = arbol.feature[nodo];
      const val = X[fIdx];
      const th = arbol.threshold[nodo];
      if (val <= th) {{
        nodo = arbol.left[nodo];
      }} else {{
        nodo = arbol.right[nodo];
      }}
    }}
    const v = arbol.values[nodo];
    const probArbol = v[1] / (v[0] + v[1]);
    votosClase1 += probArbol;
  }}

  const probDiabetes = (votosClase1 / nArboles) * 100;
  const probNoDiabetes = 100 - probDiabetes;
  const prediccion = probDiabetes >= 50 ? 1 : 0;

  let nivel_riesgo = "Bajo";
  let color_alerta = "verde";
  let diagnostico = "Perfil Compatible con Paciente No Diabético";
  let recomendacion = "Mantener hábitos de vida saludables, dieta equilibrada y chequeo anual de rutina.";

  if (probDiabetes >= 65) {{
    nivel_riesgo = "Alto";
    color_alerta = "rojo";
    diagnostico = "Alta Probabilidad de Diabetes Mellitus";
    recomendacion = "Requiere valoración médica inmediata con endocrinología y análisis de tolerancia a la glucosa.";
  }} else if (probDiabetes >= 35) {{
    nivel_riesgo = "Moderado";
    color_alerta = "ambar";
    diagnostico = "Alerta de Riesgo Moderado / Sospecha de Pre-diabetes";
    recomendacion = "Se recomienda realizar prueba de hemoglobina glucosilada (HbA1c) y consulta médica preventiva.";
  }}

  // Evaluacion de factores
  const factores = [];
  if (datos.glucosa >= 140) factores.push("Glucosa muy elevada (" + datos.glucosa + " mg/dL - hiperglucemia)");
  else if (datos.glucosa >= 100) factores.push("Glucosa en rango de pre-diabetes (" + datos.glucosa + " mg/dL)");
  if (datos.imc >= 30) factores.push("Obesidad marcada (IMC " + datos.imc + " kg/m²)");
  else if (datos.imc >= 25) factores.push("Sobrepeso (IMC " + datos.imc + " kg/m²)");
  if (datos.presion_arterial >= 80) factores.push("Presión arterial limítrofe/alta (" + datos.presion_arterial + " mmHg)");
  if (datos.edad >= 45) factores.push("Grupo etario de mayor incidencia (" + datos.edad + " años)");
  if (datos.pedigri_diabetes >= 0.5) factores.push("Carga genética familiar significativa (" + datos.pedigri_diabetes + ")");

  return {{
    exito: true,
    modo: "cliente_autonomo_github_pages",
    prediccion: prediccion,
    es_diabetico: prediccion === 1,
    probabilidad_diabetes: Math.round(probDiabetes * 10) / 10,
    probabilidad_no_diabetes: Math.round(probNoDiabetes * 10) / 10,
    nivel_riesgo: nivel_riesgo,
    color_alerta: color_alerta,
    diagnostico: diagnostico,
    recomendacion: recomendacion,
    factores_identificados: factores,
    parametros_analizados: datos
  }};
}}
"""

    RUTA_SALIDA_JS.write_text(contenido_js, encoding="utf-8")
    print(f"Modelo exportado a JS exitosamente en: {RUTA_SALIDA_JS}")


if __name__ == "__main__":
    exportar()

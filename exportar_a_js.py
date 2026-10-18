from pathlib import Path
import json
import joblib

BASE_DIR = Path(__file__).resolve().parent
RUTA_MODELO = BASE_DIR / "cerebro_diabetes.joblib"
RUTA_SALIDA_JS = BASE_DIR / "static" / "js" / "modelo_diabetes_exportado.js"

from servidor import REGLAS_BIOMARCADORES


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
            "caracteristicas": list(REGLAS_BIOMARCADORES.keys()),
            "reglas": REGLAS_BIOMARCADORES,
            "n_arboles": len(arboles),
            "arboles": arboles,
        }
    )

    contenido_js = f"""// Modelo Random Forest exportado desde scikit-learn con validacion clinica estricta
const MODELO_DIABETES_DATA = {datos_json};

function predecirDiabetesEnNavegador(datos) {{
  const reglas = MODELO_DIABETES_DATA.reglas;
  const features = MODELO_DIABETES_DATA.caracteristicas;
  const X = [];

  // 1. Validacion clinica y defensiva (misma logica que servidor.py)
  for (const f of features) {{
    const regla = reglas[f];
    const valCrudo = datos[f];

    if (valCrudo === undefined || valCrudo === null || valCrudo === "" || typeof valCrudo === "boolean") {{
      return {{ exito: false, error: "El campo '" + regla.nombre + "' contiene un valor no valido o vacio." }};
    }}

    const valNum = parseFloat(String(valCrudo).replace(",", "."));
    if (isNaN(valNum) || !isFinite(valNum)) {{
      return {{ exito: false, error: "El campo '" + regla.nombre + "' debe ser un numero finito valido." }};
    }}

    if (regla.es_entero && !Number.isInteger(valNum)) {{
      return {{ exito: false, error: "'" + regla.nombre + "' debe ser un numero entero sin decimales." }};
    }}

    if (valNum < regla.min || valNum > regla.max) {{
      return {{
        exito: false,
        error: "'" + regla.nombre + "' (" + valNum + " " + regla.unidad + ") fuera del limite clinico permitido (" + regla.rango_esperado + ")."
      }};
    }}

    X.push(valNum);
  }}

  // 2. Inferencia por votacion de arboles
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
  let recomendacion = "Mantener hábitos de vida saludables, actividad física regular y control médico anual.";

  if (probDiabetes >= 65) {{
    nivel_riesgo = "Alto";
    color_alerta = "rojo";
    diagnostico = "Alta Probabilidad de Diabetes Mellitus";
    recomendacion = "Requiere valoración médica inmediata con endocrinología para inicio de protocolo clínico.";
  }} else if (probDiabetes >= 35) {{
    nivel_riesgo = "Moderado";
    color_alerta = "ambar";
    diagnostico = "Alerta de Riesgo Moderado / Sospecha de Pre-diabetes";
    recomendacion = "Se sugiere prueba de tolerancia a la glucosa oral y hemoglobina glucosilada (HbA1c).";
  }}

  // Evaluacion de factores
  const factores = [];
  if (datos.glucosa >= 140) factores.push("Glucosa muy elevada (" + datos.glucosa + " mg/dL - hiperglucemia clínica)");
  else if (datos.glucosa >= 100) factores.push("Glucosa en rango de pre-diabetes (" + datos.glucosa + " mg/dL)");
  if (datos.imc >= 30) factores.push("Obesidad marcada (IMC " + datos.imc + " kg/m²)");
  else if (datos.imc >= 25) factores.push("Sobrepeso (IMC " + datos.imc + " kg/m²)");
  if (datos.presion_arterial >= 80) factores.push("Presión arterial limítrofe/alta (" + datos.presion_arterial + " mmHg)");
  if (datos.grosor_piel >= 35) factores.push("Pliegue cutáneo elevado (" + datos.grosor_piel + " mm - adiposidad periférica)");
  if (datos.insulina >= 166) factores.push("Hiperinsulinemia sérica (" + datos.insulina + " μU/mL)");
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
    print(f"Modelo JS actualizado con validaciones en: {RUTA_SALIDA_JS}")


if __name__ == "__main__":
    exportar()

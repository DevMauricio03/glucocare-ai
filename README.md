# 🩺 GlucoCare AI · Sistema de Predicción de Diabetes

Aplicación clínica con arquitectura **Cliente-Servidor** y compatibilidad con **GitHub Pages** para la evaluación de riesgo de diabetes asistido por Machine Learning.

---

## 📱 ¿Cómo usarlo en el celular?

### Opción 1: Alojado en GitHub Pages (Sin servidores encendidos)
1. Sube este repositorio a tu cuenta de GitHub (`DevMauricio03/diabetes-prediccion`).
2. Ve a **Settings** > **Pages** > Selecciona la rama `main` y carpeta `/ (root)`.
3. Tu app estará disponible en:
   👉 `https://DevMauricio03.github.io/diabetes-prediccion/`
4. Ábrelo desde el navegador de tu celular y ¡listo! Ejecuta el modelo de Machine Learning directamente en el dispositivo móvil.

---

### Opción 2: Con Servidor Local Flask + MongoDB
Si tu computadora y tu celular están en la misma red Wi-Fi:
1. Inicia el servidor backend en tu computadora:
   ```bash
   python servidor.py
   ```
2. Abre en el navegador de tu celular la IP local de tu computadora:
   👉 `http://192.168.1.130:5002`

---

## 🏗️ Arquitectura del Proyecto

- **Base de Datos**: `diabetes_db` en MongoDB (colección `pacientes`), alimentada desde `base de datos/diabetes.csv`.
- **Backend**: Servidor REST API en Python/Flask (`servidor.py`) con endpoints:
  - `POST /api/predecir`
  - `GET /api/estadisticas`
  - `GET /api/pacientes-muestra`
- **Modelo de Machine Learning**: Random Forest Classifier calibrado (`cerebro_diabetes.joblib`) y exportado a motor JavaScript (`static/js/modelo_diabetes_exportado.js`).
- **Cliente**:
  - Interfaz web móvil ergonómica (`index.html`).
  - Cliente de terminal (`cliente.py`).

// app_cliente.js: Interacciones avanzadas UX y motor de diagnostico clinico

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-diabetes");
  const btnAnalizar = document.getElementById("btn-analizar");
  const tarjetaDiag = document.getElementById("tarjeta-diagnostico");
  const badgeAlerta = document.getElementById("badge-alerta");
  const textoPorcentaje = document.getElementById("cifra-porcentaje-num");
  const arcoProgreso = document.getElementById("medidor-progreso");
  const tituloDiag = document.getElementById("titulo-diagnostico");
  const descDiag = document.getElementById("desc-diagnostico");
  const listaFactores = document.getElementById("factores-lista");
  const etiquetaConexion = document.getElementById("texto-conexion");
  const bannerAlertaGlobal = document.getElementById("banner-alerta-global");
  const btnLimpiar = document.getElementById("btn-limpiar-campos");
  const modalSheet = document.getElementById("modal-sheet");
  const modalTitulo = document.getElementById("modal-titulo");
  const modalCuerpo = document.getElementById("modal-cuerpo");
  const btnCerrarModal = document.getElementById("btn-cerrar-modal");

  // Elementos del Wizard Stepper guiado
  const btnPasoAnterior = document.getElementById("btn-paso-anterior");
  const btnPasoSiguiente = document.getElementById("btn-paso-siguiente");
  const textoBtnSiguiente = document.getElementById("texto-btn-siguiente");
  const textoBtnAnalizar = document.getElementById("texto-btn-analizar");
  const stepperTextoPaso = document.getElementById("stepper-texto-paso");
  const stepperTextoPct = document.getElementById("stepper-texto-pct");
  const stepperBarraProgreso = document.getElementById("stepper-barra-progreso");

  // Reglas y rangos de referencia para feedback visual en tiempo real
  const REGLAS = {
    embarazos: { min: 0, max: 25, sanoMin: 0, sanoMax: 3, entero: true, nombre: "Número de embarazos", unidad: "gestaciones" },
    glucosa: { min: 30, max: 600, sanoMin: 70, sanoMax: 99, entero: false, nombre: "Glucosa plasmática", unidad: "mg/dL" },
    presion_arterial: { min: 30, max: 180, sanoMin: 60, sanoMax: 80, entero: false, nombre: "Presión arterial", unidad: "mmHg" },
    grosor_piel: { min: 2, max: 99, sanoMin: 10, sanoMax: 30, entero: false, nombre: "Pliegue cutáneo", unidad: "mm" },
    insulina: { min: 0, max: 850, sanoMin: 16, sanoMax: 166, entero: false, nombre: "Insulina sérica", unidad: "μU/mL" },
    imc: { min: 10, max: 80, sanoMin: 18.5, sanoMax: 24.9, entero: false, nombre: "IMC", unidad: "kg/m²" },
    pedigri_diabetes: { min: 0.05, max: 2.50, sanoMin: 0.08, sanoMax: 0.50, entero: false, nombre: "Pedigrí genético", unidad: "índice" },
    edad: { min: 1, max: 120, sanoMin: 18, sanoMax: 45, entero: true, nombre: "Edad del paciente", unidad: "años" }
  };

  // Detectar entorno de ejecucion
  const esGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";
  if (esGitHubPages && etiquetaConexion) {
    etiquetaConexion.textContent = "Motor ML en Celular";
  }

  // Perfiles de prueba clinica
  const perfiles = {
    sano: {
      embarazos: 1, glucosa: 85, presion_arterial: 66,
      grosor_piel: 23, insulina: 94, imc: 22.4,
      pedigri_diabetes: 0.167, edad: 24
    },
    moderado: {
      embarazos: 3, glucosa: 135, presion_arterial: 76,
      grosor_piel: 28, insulina: 110, imc: 29.8,
      pedigri_diabetes: 0.450, edad: 42
    },
    critico: {
      embarazos: 6, glucosa: 178, presion_arterial: 88,
      grosor_piel: 38, insulina: 220, imc: 36.5,
      pedigri_diabetes: 0.850, edad: 54
    }
  };

  // Actualizar la mini barra de rango visual de cada campo
  function actualizarMarcadorVisual(campo, valor) {
    const marcador = document.getElementById(`marcador-${campo}`);
    if (!marcador) return;
    const regla = REGLAS[campo];
    if (isNaN(valor)) {
      marcador.style.left = "0%";
      return;
    }
    const pct = Math.max(0, Math.min(100, ((valor - regla.min) / (regla.max - regla.min)) * 100));
    marcador.style.left = `${pct}%`;
  }

  // Limpiar errores
  function limpiarErrores() {
    document.querySelectorAll(".error-msg-campo").forEach(el => el.textContent = "");
    document.querySelectorAll(".campo-input").forEach(el => el.classList.remove("input-error"));
    if (bannerAlertaGlobal) {
      bannerAlertaGlobal.style.display = "none";
      bannerAlertaGlobal.textContent = "";
    }
  }

  function mostrarErrorCampo(campo, mensaje) {
    const input = document.getElementById(campo);
    const errSpan = document.getElementById(`err-${campo}`);
    if (input) input.classList.add("input-error");
    if (errSpan) errSpan.innerHTML = `⚠️ ${mensaje}`;
  }

  // Validacion y feedback en tiempo real
  Object.keys(REGLAS).forEach(campo => {
    const input = document.getElementById(campo);
    if (!input) return;

    // Bloquear caracteres de notación científica ('e', 'E') y signos (+, -) en teclado
    input.addEventListener("keydown", (e) => {
      if (["e", "E", "+", "-"].includes(e.key)) {
        e.preventDefault();
      }
    });

    // Bloquear si intentan pegarlo con Ctrl+V / Cmd+V
    input.addEventListener("paste", (e) => {
      const textoPegado = (e.clipboardData || window.clipboardData).getData("text");
      if (/[eE+-]/.test(textoPegado)) {
        e.preventDefault();
        const textoLimpio = textoPegado.replace(/[eE+-]/g, "");
        document.execCommand("insertText", false, textoLimpio);
      }
    });

    input.addEventListener("input", () => {
      input.classList.remove("input-error");
      const errSpan = document.getElementById(`err-${campo}`);
      if (errSpan) errSpan.textContent = "";

      // Limpiar residuo si algún método de entrada coló 'e', 'E', '+', '-'
      if (/[eE+-]/.test(input.value)) {
        input.value = input.value.replace(/[eE+-]/g, "");
      }

      const valorTexto = input.value.trim().replace(",", ".");
      if (valorTexto === "") {
        actualizarMarcadorVisual(campo, REGLAS[campo].min);
        return;
      }

      const num = parseFloat(valorTexto);
      const regla = REGLAS[campo];

      if (isNaN(num)) {
        mostrarErrorCampo(campo, "Ingresa un número válido");
        return;
      }

      actualizarMarcadorVisual(campo, num);

      if (num < regla.min) {
        mostrarErrorCampo(campo, `Mínimo biológico: ${regla.min} ${regla.unidad}`);
      } else if (num > regla.max) {
        mostrarErrorCampo(campo, `Máximo fisiológico: ${regla.max} ${regla.unidad}`);
      }
    });
  });

  // Tooltips contextuales de ayuda (Explicaciones sencillas de terminos medicos)
  document.querySelectorAll(".btn-info-tooltip").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const campo = btn.dataset.campo;
      const caja = document.getElementById(`exp-${campo}`);
      if (caja) {
        const visible = caja.style.display === "block";
        document.querySelectorAll(".caja-explicacion").forEach(c => c.style.display = "none");
        caja.style.display = visible ? "none" : "block";
      }
    });
  });

  // Fases del Wizard Stepper guiado
  const FASES = [
    {
      id: "sangre",
      nombre: "Fase 1: Perfil Glucémico (Sangre)",
      pct: 33,
      pctTexto: "Paso 1 / 3",
      siguienteTexto: "Siguiente: Antropometría",
      campos: ["glucosa", "insulina", "presion_arterial"]
    },
    {
      id: "cuerpo",
      nombre: "Fase 2: Antropometría & Composición",
      pct: 66,
      pctTexto: "Paso 2 / 3",
      siguienteTexto: "Siguiente: Perfil",
      campos: ["imc", "grosor_piel"]
    },
    {
      id: "perfil",
      nombre: "Fase 3: Datos Demográficos & Pedigrí",
      pct: 100,
      pctTexto: "Paso 3 / 3",
      campos: ["edad", "embarazos", "pedigri_diabetes"]
    }
  ];

  let faseActual = 0; // 0: sangre, 1: cuerpo, 2: perfil, -1: todos

  // Función para cambiar de fase en el Wizard
  function irAFase(index) {
    limpiarErrores();
    faseActual = index;

    document.querySelectorAll(".paso-tab").forEach(t => t.classList.remove("activo"));

    if (index === -1) {
      // Modo "Todos": ver todo continuo
      const tabTodos = document.getElementById("tab-todos");
      if (tabTodos) tabTodos.classList.add("activo");

      document.querySelectorAll(".card-grupo").forEach(g => g.style.display = "flex");

      if (btnPasoAnterior) btnPasoAnterior.style.display = "none";
      if (btnPasoSiguiente) btnPasoSiguiente.style.display = "none";
      if (btnAnalizar) {
        btnAnalizar.style.display = "flex";
        if (textoBtnAnalizar) textoBtnAnalizar.textContent = "Evaluar Paciente Completo";
      }

      if (stepperTextoPaso) stepperTextoPaso.textContent = "Vista Completa: Todos los Biomarcadores";
      if (stepperTextoPct) stepperTextoPct.textContent = "100%";
      if (stepperBarraProgreso) stepperBarraProgreso.style.width = "100%";
      return;
    }

    const fase = FASES[index];
    const tabFase = document.getElementById(`tab-${fase.id}`);
    if (tabFase) tabFase.classList.add("activo");

    // Mostrar exclusivamente la card de la fase seleccionada
    document.querySelectorAll(".card-grupo").forEach(g => {
      if (g.dataset.categoria === fase.id) {
        g.style.display = "flex";
      } else {
        g.style.display = "none";
      }
    });

    // Actualizar barra de progreso y encabezado
    if (stepperTextoPaso) stepperTextoPaso.textContent = fase.nombre;
    if (stepperTextoPct) stepperTextoPct.textContent = fase.pctTexto;
    if (stepperBarraProgreso) stepperBarraProgreso.style.width = `${fase.pct}%`;

    // Configurar botones de navegación ergonómica en la zona del pulgar
    if (index === 0) {
      // Fase 1: Sangre
      if (btnPasoAnterior) btnPasoAnterior.style.display = "none";
      if (btnPasoSiguiente) {
        btnPasoSiguiente.style.display = "flex";
        if (textoBtnSiguiente) textoBtnSiguiente.textContent = fase.siguienteTexto;
      }
      if (btnAnalizar) btnAnalizar.style.display = "none";
    } else if (index === 1) {
      // Fase 2: Cuerpo
      if (btnPasoAnterior) btnPasoAnterior.style.display = "inline-flex";
      if (btnPasoSiguiente) {
        btnPasoSiguiente.style.display = "flex";
        if (textoBtnSiguiente) textoBtnSiguiente.textContent = fase.siguienteTexto;
      }
      if (btnAnalizar) btnAnalizar.style.display = "none";
    } else if (index === 2) {
      // Fase 3: Perfil (Final)
      if (btnPasoAnterior) btnPasoAnterior.style.display = "inline-flex";
      if (btnPasoSiguiente) btnPasoSiguiente.style.display = "none";
      if (btnAnalizar) {
        btnAnalizar.style.display = "flex";
        if (textoBtnAnalizar) textoBtnAnalizar.textContent = "Evaluar Diagnóstico Completo";
      }
    }
  }

  // Validar únicamente los campos de una fase específica
  function validarFase(camposFase) {
    let tieneError = false;
    let primerError = null;

    camposFase.forEach(campo => {
      const regla = REGLAS[campo];
      const input = document.getElementById(campo);
      const valorStr = input ? input.value.trim().replace(",", ".") : "";

      if (!input || valorStr === "") {
        mostrarErrorCampo(campo, "Campo obligatorio");
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }

      const num = parseFloat(valorStr);
      if (isNaN(num) || !isFinite(num)) {
        mostrarErrorCampo(campo, "Número no válido");
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }

      if (regla.entero && !Number.isInteger(num)) {
        mostrarErrorCampo(campo, "Debe ser número entero");
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }

      if (num < regla.min || num > regla.max) {
        mostrarErrorCampo(campo, `Límite: ${regla.min} a ${regla.max} ${regla.unidad}`);
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }
    });

    if (primerError) {
      primerError.focus();
      primerError.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return !tieneError;
  }

  // Evento botón "Siguiente"
  if (btnPasoSiguiente) {
    btnPasoSiguiente.addEventListener("click", () => {
      if (faseActual >= 0 && faseActual < FASES.length - 1) {
        const faseConfig = FASES[faseActual];
        const esValida = validarFase(faseConfig.campos);
        if (esValida) {
          const tabActual = document.getElementById(`tab-${faseConfig.id}`);
          if (tabActual) tabActual.classList.add("completado");
          irAFase(faseActual + 1);
          const sigCampoId = FASES[faseActual].campos[0];
          document.getElementById(sigCampoId)?.focus();
        }
      }
    });
  }

  // Evento botón "Anterior"
  if (btnPasoAnterior) {
    btnPasoAnterior.addEventListener("click", () => {
      if (faseActual > 0) {
        irAFase(faseActual - 1);
      }
    });
  }

  // Navegación táctil por pestañas
  document.querySelectorAll(".paso-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const filtro = tab.dataset.filtro;
      if (filtro === "todos") {
        irAFase(-1);
      } else {
        const idx = FASES.findIndex(f => f.id === filtro);
        if (idx !== -1) {
          irAFase(idx);
        }
      }
    });
  });

  // Inicializar en Fase 1
  irAFase(0);

  // Chips de seleccion rapida con micro-interaccion
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      limpiarErrores();
      document.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");

      const tipo = btn.dataset.perfil;
      const datos = perfiles[tipo];
      if (datos) {
        for (const [campo, valor] of Object.entries(datos)) {
          const input = document.getElementById(campo);
          if (input) {
            input.value = valor;
            actualizarMarcadorVisual(campo, valor);
          }
        }
        FASES.forEach(f => {
          document.getElementById(`tab-${f.id}`)?.classList.add("completado");
        });
        enviarPeticionDiagnostico();
      }
    });
  });

  // Boton Limpiar campos
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      limpiarErrores();
      form.reset();
      document.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("activo"));
      document.querySelectorAll(".paso-tab").forEach(t => t.classList.remove("completado"));
      Object.keys(REGLAS).forEach(c => actualizarMarcadorVisual(c, REGLAS[c].min));
      irAFase(0);
      document.getElementById("glucosa")?.focus();
    });
  }

  // Envio de formulario
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    enviarPeticionDiagnostico();
  });

  async function enviarPeticionDiagnostico() {
    limpiarErrores();
    const payload = {};
    let primerErrorCampo = null;
    let hayErrores = false;

    for (const [campo, regla] of Object.entries(REGLAS)) {
      const input = document.getElementById(campo);
      const valorStr = input ? input.value.trim().replace(",", ".") : "";

      if (!input || valorStr === "") {
        mostrarErrorCampo(campo, `Campo obligatorio`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      const num = parseFloat(valorStr);
      if (isNaN(num) || !isFinite(num)) {
        mostrarErrorCampo(campo, `Número no válido`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      if (regla.entero && !Number.isInteger(num)) {
        mostrarErrorCampo(campo, `Debe ser número entero`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      if (num < regla.min || num > regla.max) {
        mostrarErrorCampo(campo, `Límite permitido: ${regla.min} a ${regla.max} ${regla.unidad}`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      payload[campo] = regla.entero ? parseInt(num, 10) : num;
    }

    if (hayErrores) {
      if (primerErrorCampo) {
        const campoErrId = primerErrorCampo.id;
        const faseDelError = FASES.findIndex(f => f.campos.includes(campoErrId));
        if (faseDelError !== -1 && faseActual !== faseDelError && faseActual !== -1) {
          irAFase(faseDelError);
        }
        if (bannerAlertaGlobal) {
          bannerAlertaGlobal.textContent = "Por favor completa los biomarcadores pendientes para obtener el dictamen.";
          bannerAlertaGlobal.style.display = "block";
        }
        primerErrorCampo.scrollIntoView({ behavior: "smooth", block: "center" });
        primerErrorCampo.focus();
      }
      return;
    }

    // Feedback táctil visual de procesamiento
    btnAnalizar.disabled = true;
    btnAnalizar.innerHTML = `
      <svg class="anim-girar" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
      <span>Analizando Biomarcadores...</span>
    `;

    let resultado = null;

    if (!esGitHubPages) {
      try {
        const respuesta = await fetch("/api/predecir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await respuesta.json();
        if (respuesta.ok && data.exito) {
          resultado = data;
        } else {
          if (bannerAlertaGlobal) {
            bannerAlertaGlobal.textContent = "Alerta del Servidor: " + (data.error || "Datos no procesables");
            bannerAlertaGlobal.style.display = "block";
          }
        }
      } catch (err) {
        console.warn("Backend no disponible, recurriendo a motor local:", err);
      }
    }

    if (!resultado && typeof predecirDiabetesEnNavegador === "function") {
      resultado = predecirDiabetesEnNavegador(payload);
      if (resultado && !resultado.exito) {
        if (bannerAlertaGlobal) {
          bannerAlertaGlobal.textContent = resultado.error;
          bannerAlertaGlobal.style.display = "block";
        }
        resultado = null;
      }
    }

    if (resultado && resultado.exito) {
      // Haptic feedback en dispositivos compatibles
      if (navigator.vibrate) navigator.vibrate(50);
      actualizarInterfazResultado(resultado);
      tarjetaDiag.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    btnAnalizar.disabled = false;
    btnAnalizar.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
      <span>Evaluar Paciente en Servidor</span>
    `;
  }

  // Animacion fluida del contador numerico
  function animarContador(elemento, valorFinal, duracionMs = 700) {
    let inicio = 0;
    const pasos = 25;
    const incremento = valorFinal / pasos;
    const intervaloMs = duracionMs / pasos;
    const timer = setInterval(() => {
      inicio += incremento;
      if (inicio >= valorFinal) {
        elemento.textContent = `${Math.round(valorFinal)}%`;
        clearInterval(timer);
      } else {
        elemento.textContent = `${Math.round(inicio)}%`;
      }
    }, intervaloMs);
  }

  function actualizarInterfazResultado(data) {
    const prob = data.probabilidad_diabetes;
    const color = data.color_alerta;

    tarjetaDiag.className = `tarjeta-diagnostico estado-${color}`;
    badgeAlerta.className = `badge-alerta ${color}`;
    badgeAlerta.textContent = `Riesgo ${data.nivel_riesgo}`;

    // Actualizar arco de gauge
    const perimetro = 226;
    const offset = perimetro - (perimetro * (prob / 100));
    arcoProgreso.style.strokeDashoffset = offset;
    
    if (color === "verde") arcoProgreso.style.stroke = "#10b981";
    else if (color === "ambar") arcoProgreso.style.stroke = "#f59e0b";
    else arcoProgreso.style.stroke = "#ef4444";

    animarContador(textoPorcentaje, prob);
    tituloDiag.textContent = data.diagnostico;
    descDiag.textContent = data.recomendacion;

    listaFactores.innerHTML = "";
    if (data.factores_identificados && data.factores_identificados.length > 0) {
      const headerItem = document.createElement("div");
      headerItem.className = "factor-titulo-fila";
      headerItem.textContent = "Biomarcadores alterados:";
      listaFactores.appendChild(headerItem);

      data.factores_identificados.forEach(f => {
        const item = document.createElement("div");
        item.className = "factor-item";
        item.innerHTML = `<span>⚠️</span> <span>${f}</span>`;
        listaFactores.appendChild(item);
      });
      listaFactores.style.display = "flex";
    } else {
      listaFactores.style.display = "none";
    }
  }

  // Modal estilo Bottom Sheet
  function abrirModal(titulo, htmlContenido) {
    if (!modalSheet) return;
    modalTitulo.textContent = titulo;
    modalCuerpo.innerHTML = htmlContenido;
    modalSheet.style.display = "flex";
  }

  function cerrarModal() {
    if (modalSheet) modalSheet.style.display = "none";
  }

  if (btnCerrarModal) btnCerrarModal.addEventListener("click", cerrarModal);
  if (modalSheet) {
    modalSheet.addEventListener("click", (e) => {
      if (e.target === modalSheet) cerrarModal();
    });
  }

  // Barra de navegacion inferior
  document.querySelectorAll(".nav-item").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("activo"));
      tab.classList.add("activo");
      const accion = tab.dataset.tab;

      if (accion === "inicio") {
        document.querySelector(".contenido-scroll").scrollTo({ top: 0, behavior: "smooth" });
      } else if (accion === "stats") {
        cargarEstadisticasModal();
      } else if (accion === "info") {
        abrirModal(
          "Acerca de GlucoCare AI",
          `<p style="font-size:14px; color:#475569; line-height:1.6;">
            <strong>GlucoCare AI</strong> es un sistema clínico de soporte diagnóstico basado en Machine Learning (Random Forest) calibrado con estándares internacionales de la ADA/OMS.
           </p>
           <div style="background:#f1f5f9; padding:12px; border-radius:12px; margin-top:10px; font-size:13px; color:#334155;">
            <strong>Pilares UX Incorporados:</strong><br>
            • Zona ergonómica del pulgar para smartphone.<br>
            • Mini-barras visuales de salud por parámetro.<br>
            • Segmentación táctil por fases clínicas.<br>
            • Triple validación defensiva (Usuario, Alteraciones y Ataques).
           </div>`
        );
      }
    });
  });

  async function cargarEstadisticasModal() {
    let contenido = "";
    try {
      const res = await fetch("/api/estadisticas");
      if (res.ok) {
        const d = await res.json();
        contenido = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;">
            <div style="background:#f0f9ff; padding:14px; border-radius:14px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#0284c7;">${d.total_registros}</div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Pacientes en Base</div>
            </div>
            <div style="background:#fef2f2; padding:14px; border-radius:14px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#dc2626;">${d.prevalencia}%</div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Prevalencia</div>
            </div>
          </div>
          <div style="margin-top:12px; font-size:13px; color:#475569; line-height:1.5;">
            • Base de datos: <strong>${d.base_datos}.${d.coleccion}</strong><br>
            • Casos con Diabetes: <strong>${d.casos_diabeticos}</strong><br>
            • Casos Sanos / Control: <strong>${d.casos_no_diabeticos}</strong>
          </div>
        `;
        abrirModal("Base de Datos MongoDB", contenido);
        return;
      }
    } catch (e) {}

    contenido = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;">
        <div style="background:#f0f9ff; padding:14px; border-radius:14px; text-align:center;">
          <div style="font-size:24px; font-weight:800; color:#0284c7;">768</div>
          <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Historias Clínicas</div>
        </div>
        <div style="background:#fef2f2; padding:14px; border-radius:14px; text-align:center;">
          <div style="font-size:24px; font-weight:800; color:#dc2626;">34.9%</div>
          <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Prevalencia</div>
        </div>
      </div>
    `;
    abrirModal("Estadísticas del Dataset", contenido);
  }
});

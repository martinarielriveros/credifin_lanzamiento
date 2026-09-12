/**
 * Application Controller for Credifin Routes Visualizer
 */
document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    routes: [],
    groups: [],
    activeGroups: new Set(),
    selectedFile: null,
    stats: {}
  };

  // Map Instance
  const mapManager = new RoutesMap('map');
  window.RoutesApp = {
    focusRoute: (id) => mapManager.focusRoute(id)
  };

  // DOM Elements
  const elements = {
    statRoutes: document.getElementById('stat-routes'),
    statGroups: document.getElementById('stat-groups'),
    statCities: document.getElementById('stat-cities'),
    statKm: document.getElementById('stat-km'),
    
    groupListContainer: document.getElementById('group-list-container'),
    activeGroupsSummary: document.getElementById('active-groups-summary'),
    btnToggleAllGroups: document.getElementById('btn-toggle-all-groups'),
    groupSearchInput: document.getElementById('group-search-input'),
    btnFitVisible: document.getElementById('btn-fit-visible'),
    
    routeListBody: document.getElementById('route-list-body'),
    routeSearchInput: document.getElementById('route-search-input'),
    visibleRoutesCount: document.getElementById('visible-routes-count'),
    routeExplorerDrawer: document.getElementById('route-explorer-drawer'),
    drawerHeader: document.getElementById('drawer-header'),
    drawerToggleBtn: document.getElementById('drawer-toggle-btn'),
    
    btnOpenUpload: document.getElementById('btn-open-upload'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    btnClearRoutes: document.getElementById('btn-clear-routes'),
    
    uploadModal: document.getElementById('upload-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),
    csvDropzone: document.getElementById('csv-dropzone'),
    dropzoneTitle: document.getElementById('dropzone-title'),
    dropzoneDesc: document.getElementById('dropzone-desc'),
    csvFileInput: document.getElementById('csv-file-input'),
    selectedFilePill: document.getElementById('selected-file-pill'),
    selectedFilename: document.getElementById('selected-filename'),
    btnRemoveSelectedFile: document.getElementById('btn-remove-selected-file'),
    btnSubmitUpload: document.getElementById('btn-submit-upload'),
    uploadFeedback: document.getElementById('upload-feedback'),
    toastContainer: document.getElementById('toast-container')
  };

  // Toast notifications
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Load initial data
  async function refreshData(fitMap = false) {
    try {
      const [routesData, groupsData, statsData] = await Promise.all([
        API.getRoutes(),
        API.getGroups(),
        API.getStats()
      ]);

      state.routes = routesData.routes || [];
      state.groups = groupsData.groups || [];
      state.stats = statsData || {};

      // If activeGroups is empty, activate all groups by default
      if (state.activeGroups.size === 0 && state.groups.length > 0) {
        state.groups.forEach(g => state.activeGroups.add(g.grupo));
      }

      updateStatsUI();
      renderGroupSelector();
      renderRouteList();
      mapManager.renderRoutes(state.routes, state.activeGroups);

      if (fitMap) {
        mapManager.fitVisible();
      }
    } catch (err) {
      console.error(err);
      showToast('Error al conectar con la base de datos de rutas.', 'error');
    }
  }

  // Update Stats Header
  function updateStatsUI() {
    elements.statRoutes.textContent = state.stats.total_routes || 0;
    elements.statGroups.textContent = state.stats.total_groups || 0;
    elements.statCities.textContent = state.stats.total_cities || 0;
    elements.statKm.textContent = `${(state.stats.total_km || 0).toLocaleString()} km`;
  }

  // Render Group Selector Overlay
  function renderGroupSelector() {
    const filterTerm = (elements.groupSearchInput.value || '').trim().toLowerCase();
    elements.groupListContainer.innerHTML = '';

    if (state.groups.length === 0) {
      elements.groupListContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 12px;">
          No hay grupos disponibles.<br>Sube un CSV o carga el ejemplo.
        </div>
      `;
      elements.activeGroupsSummary.textContent = '0 de 0 grupos activos';
      return;
    }

    const filtered = state.groups.filter(g => g.grupo.toLowerCase().includes(filterTerm));

    filtered.forEach(g => {
      const isChecked = state.activeGroups.has(g.grupo);
      const color = mapManager.getColorForGroup(g.grupo);

      const item = document.createElement('div');
      item.className = `group-item ${isChecked ? 'active' : ''}`;
      item.innerHTML = `
        <div class="group-item-left">
          <input type="checkbox" class="group-checkbox" ${isChecked ? 'checked' : ''} style="accent-color: ${color}; cursor: pointer;">
          <span class="group-color-dot" style="background-color: ${color}; color: ${color};"></span>
          <span class="group-name" title="${g.grupo}">${g.grupo}</span>
        </div>
        <div class="group-item-right">
          <button class="group-solo-btn" title="Ver solo este grupo">Solo este</button>
          <span class="group-count-badge">${g.count}</span>
        </div>
      `;

      // Checkbox / item toggle
      const checkbox = item.querySelector('.group-checkbox');
      const toggleGroup = () => {
        if (state.activeGroups.has(g.grupo)) {
          state.activeGroups.delete(g.grupo);
        } else {
          state.activeGroups.add(g.grupo);
        }
        applyGroupFilters();
      };

      item.addEventListener('click', (e) => {
        if (e.target.closest('.group-solo-btn') || e.target === checkbox) return;
        toggleGroup();
      });

      checkbox.addEventListener('change', () => {
        toggleGroup();
      });

      // Solo button: deactivate all others, keep only this one
      const soloBtn = item.querySelector('.group-solo-btn');
      soloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.activeGroups.clear();
        state.activeGroups.add(g.grupo);
        applyGroupFilters();
        showToast(`Filtrando solo: ${g.grupo}`, 'info');
      });

      elements.groupListContainer.appendChild(item);
    });

    elements.activeGroupsSummary.textContent = `${state.activeGroups.size} de ${state.groups.length} grupos activos`;
  }

  // Apply group filter changes
  function applyGroupFilters() {
    renderGroupSelector();
    const visibleCount = mapManager.filterByGroups(state.activeGroups);
    renderRouteList();
    elements.visibleRoutesCount.textContent = visibleCount;
  }

  // Render Routes Drawer List
  function renderRouteList() {
    const filterTerm = (elements.routeSearchInput.value || '').trim().toLowerCase();
    elements.routeListBody.innerHTML = '';

    const visibleRoutes = state.routes.filter(r => {
      const inActiveGroup = state.activeGroups.has(r.grupo);
      if (!inActiveGroup) return false;
      if (!filterTerm) return true;
      const textMatch = `${r.ciudad1} ${r.provincia1} ${r.ciudad2} ${r.grupo}`.toLowerCase();
      return textMatch.includes(filterTerm);
    });

    elements.visibleRoutesCount.textContent = visibleRoutes.length;

    if (visibleRoutes.length === 0) {
      elements.routeListBody.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 12px;">
          No hay rutas para mostrar con los filtros actuales.
        </div>
      `;
      return;
    }

    visibleRoutes.forEach(r => {
      const color = mapManager.getColorForGroup(r.grupo);
      const card = document.createElement('div');
      card.className = 'route-card';
      card.setAttribute('data-id', r.id);
      card.innerHTML = `
        <div class="route-card-top">
          <span class="route-group-tag" style="background: ${color};">${r.grupo}</span>
          <span class="route-distance-tag"><i class="fa-solid fa-road"></i> ${r.distance_km} km</span>
        </div>
        <div class="route-path-visual">
          <span class="city-origin">${r.ciudad1}</span>
          <i class="fa-solid fa-arrow-right-long arrow-icon"></i>
          <span class="city-dest">${r.ciudad2}</span>
        </div>
        <div class="route-geo-preview">
          📍 ${r.provincia1 ? r.provincia1 + ' | ' : ''}Lat: ${r.lat1.toFixed(3)}, Lon: ${r.lon1.toFixed(3)}
        </div>
      `;

      card.addEventListener('click', () => {
        selectRouteCard(r.id);
        mapManager.focusRoute(r.id);
      });

      elements.routeListBody.appendChild(card);
    });
  }

  // Group search input listener
  elements.groupSearchInput.addEventListener('input', () => {
    renderGroupSelector();
  });

  // Route search input listener
  elements.routeSearchInput.addEventListener('input', () => {
    renderRouteList();
  });

  // Toggle all groups button
  elements.btnToggleAllGroups.addEventListener('click', () => {
    if (state.activeGroups.size === state.groups.length) {
      state.activeGroups.clear();
    } else {
      state.groups.forEach(g => state.activeGroups.add(g.grupo));
    }
    applyGroupFilters();
  });

  // Fit visible routes button
  elements.btnFitVisible.addEventListener('click', () => {
    mapManager.fitVisible();
  });

  // Route drawer collapse toggle
  elements.drawerHeader.addEventListener('click', () => {
    elements.routeExplorerDrawer.classList.toggle('collapsed');
  });

  // Distance markers on trajectories toggle mark (ON / OFF)
  const btnToggleDistances = document.getElementById('btn-toggle-distances');
  if (btnToggleDistances) {
    btnToggleDistances.addEventListener('click', () => {
      const isShowing = mapManager.toggleDistances();
      btnToggleDistances.classList.toggle('active', isShowing);
      const statusPill = btnToggleDistances.querySelector('.toggle-pill-status');
      if (statusPill) {
        statusPill.textContent = isShowing ? 'ON' : 'OFF';
        statusPill.classList.toggle('off', !isShowing);
      }
      showToast(isShowing ? 'Marcas de distancia (km) ACTIVADAS en cada trayectoria' : 'Marcas de distancia (km) DESACTIVADAS', 'info');
    });
  }

  // Base map style switcher buttons
  document.querySelectorAll('.map-top-controls .style-btn, .map-style-switcher .style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const styleKey = btn.getAttribute('data-style');
      mapManager.setTileStyle(styleKey);
    });
  });

  // Load sample dataset
  elements.btnLoadSample.addEventListener('click', async () => {
    try {
      elements.btnLoadSample.disabled = true;
      elements.btnLoadSample.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando...';
      const res = await API.loadSample();
      showToast(res.message || 'Rutas de ejemplo cargadas con éxito.', 'success');
      await refreshData(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      elements.btnLoadSample.disabled = false;
      elements.btnLoadSample.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Ejemplo</span>';
    }
  });

  // Clear all routes
  elements.btnClearRoutes.addEventListener('click', async () => {
    if (!confirm('¿Seguro que deseas eliminar todas las rutas de la base de datos SQLite?')) return;
    try {
      await API.clearRoutes();
      state.activeGroups.clear();
      showToast('Se limpiaron todas las rutas.', 'info');
      await refreshData(false);
      mapManager.clearMapLayers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Upload Modal Open / Close
  function openModal() {
    elements.uploadModal.style.display = 'flex';
    resetUploadForm();
  }

  function closeModal() {
    elements.uploadModal.style.display = 'none';
    resetUploadForm();
  }

  function resetUploadForm() {
    state.selectedFile = null;
    elements.csvFileInput.value = '';
    elements.dropzoneTitle.textContent = 'Arrastra y suelta tu archivo CSV aquí';
    elements.dropzoneDesc.textContent = 'o haz clic para explorar en tu computadora';
    elements.dropzoneDesc.style.display = 'block';
    elements.selectedFilePill.style.display = 'none';
    elements.btnSubmitUpload.disabled = true;
    elements.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-upload"></i> Procesar y Visualizar';
    elements.uploadFeedback.style.display = 'none';
  }

  elements.btnOpenUpload.addEventListener('click', openModal);
  elements.btnCloseModal.addEventListener('click', closeModal);
  elements.btnCancelModal.addEventListener('click', closeModal);

  // Dropzone handling
  elements.csvDropzone.addEventListener('click', (e) => {
    // Only trigger if not clicking the remove or action button
    if (e.target.closest('#btn-remove-selected-file')) return;
    if (e.target === elements.csvFileInput) return;
    elements.csvFileInput.click();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    elements.csvDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.csvDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    elements.csvDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.csvDropzone.classList.remove('dragover');
    });
  });

  elements.csvDropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  elements.csvFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!file) return;
    
    // Flexible filename check (case-insensitive)
    const lowerName = (file.name || '').toLowerCase();
    const isCsvOrText = lowerName.endsWith('.csv') || lowerName.endsWith('.txt') || lowerName.endsWith('.tsv') || lowerName.endsWith('.csv.txt') || file.type.includes('csv') || file.type.includes('text') || !file.type;
    
    if (!isCsvOrText) {
      showToast('Por favor selecciona un archivo de formato CSV válido (.csv)', 'error');
      return;
    }

    state.selectedFile = file;
    elements.selectedFilename.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    elements.selectedFilePill.style.display = 'inline-flex';
    elements.dropzoneTitle.textContent = 'Archivo listo para procesar';
    elements.dropzoneDesc.textContent = 'Haz clic en "Procesar y Visualizar" para cargar las rutas';
    elements.dropzoneDesc.style.display = 'block';
    elements.uploadFeedback.style.display = 'none';

    // Enable the "Procesar y Visualizar" button
    elements.btnSubmitUpload.disabled = false;
    elements.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-upload"></i> Procesar y Visualizar';
  }

  elements.btnRemoveSelectedFile.addEventListener('click', (e) => {
    e.stopPropagation();
    resetUploadForm();
  });

  async function executeUpload() {
    const file = state.selectedFile;
    if (!file) {
      showToast('Por favor selecciona un archivo CSV primero.', 'error');
      return;
    }

    const modeInput = document.querySelector('input[name="upload-mode"]:checked');
    const mode = modeInput ? modeInput.value : 'replace';

    // Show loading UI in dropzone and button
    elements.dropzoneTitle.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i> Procesando e importando rutas...';
    elements.dropzoneDesc.textContent = 'Geocodificando coordenadas y guardando en SQLite...';
    elements.dropzoneDesc.style.display = 'block';
    elements.btnSubmitUpload.disabled = true;
    elements.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    elements.uploadFeedback.style.display = 'none';

    try {
      const res = await API.uploadCsv(file, mode);
      
      elements.dropzoneTitle.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--success);"></i> ¡Carga Exitosa!';
      elements.dropzoneDesc.textContent = `${res.message || 'Rutas procesadas correctamente'}`;
      showToast(res.message || 'Rutas importadas con éxito a SQLite!', 'success');
      
      setTimeout(async () => {
        closeModal();
        state.activeGroups.clear();
        await refreshData(true);
      }, 700);

    } catch (err) {
      console.error(err);
      elements.dropzoneTitle.textContent = 'Error al procesar archivo';
      elements.dropzoneDesc.textContent = 'Revisa el formato e intenta nuevamente';
      elements.uploadFeedback.textContent = `Error: ${err.message}`;
      elements.uploadFeedback.style.display = 'block';
      elements.btnSubmitUpload.disabled = false;
      elements.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-upload"></i> Procesar y Visualizar';
      showToast(err.message, 'error');
    }
  }

  // Submit button listener
  elements.btnSubmitUpload.addEventListener('click', executeUpload);

  // Window Drag & Drop support
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const lower = (file.name || '').toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        openModal();
        handleFileSelected(file);
      }
    }
  });

  function selectRouteCard(routeId) {
    document.querySelectorAll('.route-card').forEach(c => {
      const isMatch = c.getAttribute('data-id') == routeId;
      c.classList.toggle('selected', isMatch);
      if (isMatch) {
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // Expose RoutesApp globally for popup links and map interactions
  window.RoutesApp = {
    focusRoute: (id) => {
      selectRouteCard(id);
      mapManager.focusRoute(id);
    },
    selectRoute: (id) => {
      selectRouteCard(id);
      mapManager.selectRoute(id, true);
    },
    selectRouteCard: selectRouteCard
  };

  // Initial load
  refreshData(true);
});

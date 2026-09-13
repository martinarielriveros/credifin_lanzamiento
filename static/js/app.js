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
    focusRoute: (id) => mapManager.focusRoute(id),
    activateAndFocusRoute: (id, grupo) => {
      if (grupo && !state.activeGroups.has(grupo)) {
        state.activeGroups.add(grupo);
        applyGroupFilters();
      }
      selectRouteCard(id);
      mapManager.focusRoute(id);
      if (window.innerWidth <= 900) {
        closeHamburgerDrawer();
      }
    }
  };

  // DOM Elements
  const elements = {
    statRoutes: document.getElementById('stat-routes'),
    statPackages: document.getElementById('stat-packages'),
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
    
    btnSyncSheet: document.getElementById('btn-sync-sheet'),
    btnOpenUpload: document.getElementById('btn-open-upload'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    btnClearRoutes: document.getElementById('btn-clear-routes'),
    
    // Mobile & Hamburger Drawer Elements
    btnHamburger: document.getElementById('btn-hamburger'),
    hamburgerBadge: document.getElementById('hamburger-badge'),
    hamburgerBackdrop: document.getElementById('hamburger-backdrop'),
    hamburgerDrawer: document.getElementById('hamburger-drawer'),
    btnCloseHamburger: document.getElementById('btn-close-hamburger'),
    drawerFilterStatus: document.getElementById('drawer-filter-status'),
    drawerGroupSearch: document.getElementById('drawer-group-search'),
    drawerGroupList: document.getElementById('drawer-group-list'),
    btnDrawerSelectAllGroups: document.getElementById('btn-drawer-select-all-groups'),
    btnDrawerClearGroups: document.getElementById('btn-drawer-clear-groups'),
    btnDrawerFit: document.getElementById('btn-drawer-fit'),
    drawerColorBanner: document.getElementById('drawer-color-banner'),
    drawerBannerDot: document.getElementById('drawer-banner-dot'),
    drawerBannerText: document.getElementById('drawer-banner-text'),
    btnDrawerClearBand: document.getElementById('btn-drawer-clear-band'),
    drawerBandList: document.getElementById('drawer-band-list'),
    btnDrawerToggleValues: document.getElementById('btn-drawer-toggle-values'),
    btnDrawerToggleHeatmap: document.getElementById('btn-drawer-toggle-heatmap'),
    btnDrawerToggleColorMode: document.getElementById('btn-drawer-toggle-colormode'),
    drawerColorModeDesc: document.getElementById('drawer-colormode-desc'),
    drawerRouteSearch: document.getElementById('drawer-route-search'),
    drawerRoutesSummary: document.getElementById('drawer-routes-summary'),
    drawerRouteList: document.getElementById('drawer-route-list'),
    btnDrawerApplyView: document.getElementById('btn-drawer-apply-view'),
    btnDrawerSync: document.getElementById('btn-drawer-sync'),
    btnDrawerUpload: document.getElementById('btn-drawer-upload'),
    btnDrawerSample: document.getElementById('btn-drawer-sample'),
    btnDrawerClear: document.getElementById('btn-drawer-clear'),
    dstatRoutes: document.getElementById('dstat-routes'),
    dstatPackages: document.getElementById('dstat-packages'),
    dstatGroups: document.getElementById('dstat-groups'),
    dstatCities: document.getElementById('dstat-cities'),
    
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

      // NOTE: User requirement: On Start JUST CITIES must be shown on the map!
      // Therefore, state.activeGroups starts EMPTY (0 groups active).
      // The user clicks and selects routes/groups through the hamburger menu or by clicking a city pin.

      updateStatsUI();
      renderGroupSelector();
      renderDrawerGroups();
      renderRouteList();
      renderDrawerRoutes();
      mapManager.renderRoutes(state.routes, state.activeGroups);
      renderTotalLegend();
      renderDrawerBands();
      updateFilterBadges();

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
    if (elements.statPackages) {
      elements.statPackages.textContent = (state.stats.total_packages || 0).toLocaleString();
    }
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
          <span class="group-count-badge">${g.count} rutas</span>
        </div>
      `;

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
        if (e.target === checkbox) return;
        toggleGroup();
      });

      checkbox.addEventListener('change', () => {
        toggleGroup();
      });

      elements.groupListContainer.appendChild(item);
    });

    if (elements.activeGroupsSummary) {
      elements.activeGroupsSummary.textContent = `${state.activeGroups.size} de ${state.groups.length} grupos activos`;
    }
  }

  // Update Filter Badges on Header and Drawer
  function updateFilterBadges() {
    const activeCount = state.activeGroups.size;
    const totalGroups = state.groups.length;
    const badgeText = `${activeCount}`;
    if (elements.hamburgerBadge) elements.hamburgerBadge.textContent = badgeText;
    if (elements.drawerFilterStatus) {
      if (activeCount === 0) {
        elements.drawerFilterStatus.textContent = 'Solo ciudades en mapa (0 grupos seleccionados)';
      } else {
        elements.drawerFilterStatus.textContent = `${activeCount} de ${totalGroups} grupos activos`;
      }
    }
  }

  // Render Groups in Hamburger Drawer
  function renderDrawerGroups() {
    if (!elements.drawerGroupList) return;
    const filterTerm = (elements.drawerGroupSearch?.value || '').trim().toLowerCase();
    elements.drawerGroupList.innerHTML = '';

    if (state.groups.length === 0) {
      elements.drawerGroupList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">
          No hay grupos disponibles.<br>Sube un archivo CSV o carga el ejemplo.
        </div>
      `;
      return;
    }

    const filtered = state.groups.filter(g => g.grupo.toLowerCase().includes(filterTerm));

    if (filtered.length === 0) {
      elements.drawerGroupList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 13px;">
          No se encontraron grupos para "${filterTerm}".
        </div>
      `;
      return;
    }

    filtered.forEach(g => {
      const isChecked = state.activeGroups.has(g.grupo);
      const color = mapManager.getColorForGroup(g.grupo);

      const item = document.createElement('div');
      item.className = `drawer-group-item ${isChecked ? 'active' : ''}`;
      item.innerHTML = `
        <div class="drawer-group-left">
          <input type="checkbox" class="drawer-group-check" ${isChecked ? 'checked' : ''} style="accent-color: ${color}; cursor: pointer;">
          <span class="group-color-dot" style="background-color: ${color};"></span>
          <span class="drawer-group-name" title="${g.grupo}">${g.grupo}</span>
        </div>
        <div class="drawer-group-right">
          <span class="group-count-badge">${g.count} rutas</span>
        </div>
      `;

      const checkbox = item.querySelector('.drawer-group-check');
      const toggleGroup = () => {
        if (state.activeGroups.has(g.grupo)) {
          state.activeGroups.delete(g.grupo);
        } else {
          state.activeGroups.add(g.grupo);
        }
        applyGroupFilters();
      };

      item.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        toggleGroup();
      });

      checkbox.addEventListener('change', () => {
        toggleGroup();
      });

      elements.drawerGroupList.appendChild(item);
    });
  }

  // Helper to update Custom Category UI
  function updateCustomCategoryUI() {
    const box = document.getElementById('drawer-custom-category-box');
    const check = document.getElementById('check-custom-cat');
    const countEl = document.getElementById('custom-cat-count');
    const minInput = document.getElementById('custom-cat-min');
    const maxInput = document.getElementById('custom-cat-max');

    if (!box || !mapManager.customFilterCategory) return;

    const isCustomActive = mapManager.activeBands.has('custom');
    box.classList.toggle('active', isCustomActive);
    if (check) check.checked = isCustomActive;
    if (countEl) countEl.textContent = `${mapManager.customFilterCategory.count || 0}`;
    if (minInput && document.activeElement !== minInput) {
      minInput.value = mapManager.customFilterCategory.min;
    }
    if (maxInput && document.activeElement !== maxInput) {
      maxInput.value = mapManager.customFilterCategory.max;
    }
  }

  // Helper to update Category Limits UI
  function updateLimitsEditorUI() {
    const b1Input = document.getElementById('limit-val-b1');
    const b2Input = document.getElementById('limit-val-b2');
    const b4Input = document.getElementById('limit-val-b4');
    const criticoLabel = document.getElementById('limit-critico-label');

    const limits = mapManager.bandLimits || { b1: 5, b2: 15, b4: 45 };
    if (b1Input && document.activeElement !== b1Input) b1Input.value = limits.b1;
    if (b2Input && document.activeElement !== b2Input) b2Input.value = limits.b2;
    if (b4Input && document.activeElement !== b4Input) b4Input.value = limits.b4;
    const nextVal = Number(limits.b4) + 1;
    if (criticoLabel) criticoLabel.textContent = `Desde ${nextVal} bultos`;
  }

  // Render Colors Tab in Hamburger Drawer
  function renderDrawerBands() {
    if (!elements.drawerBandList) return;
    const container = elements.drawerBandList;
    const banner = elements.drawerColorBanner;
    const bannerDot = elements.drawerBannerDot;
    const bannerText = elements.drawerBannerText;

    const bands = mapManager.totalBands || [];
    container.innerHTML = '';

    const activeBands = mapManager.activeBands || new Set();
    const hasActiveFilter = activeBands.size > 0;

    if (banner) {
      if (hasActiveFilter) {
        banner.style.display = 'flex';
        const activeNames = [];
        let firstColor = '#818CF8';
        bands.forEach(b => {
          if (activeBands.has(b.index)) {
            activeNames.push(b.colorName || b.label);
            firstColor = b.color;
          }
        });
        if (activeBands.has('custom')) {
          activeNames.push('Personalizado');
          firstColor = mapManager.customFilterCategory?.color || '#A855F7';
        }
        if (bannerDot) bannerDot.style.backgroundColor = firstColor;
        if (bannerText) bannerText.innerHTML = `Mostrando: <strong style="color:${firstColor};">${activeNames.join(', ')}</strong>`;
      } else {
        banner.style.display = 'none';
      }
    }

    bands.slice().reverse().forEach(band => {
      const isSelected = activeBands.has(band.index);
      const item = document.createElement('div');
      item.className = `drawer-band-item ${isSelected ? 'active-filter' : ''}`;
      item.style.setProperty('--item-color', band.color);

      item.innerHTML = `
        <div class="drawer-band-left">
          <input type="checkbox" class="drawer-color-check" ${isSelected ? 'checked' : ''} style="accent-color: ${band.color};">
          <span class="legend-band-chip" style="background-color: ${band.color};"></span>
          <div class="drawer-band-info">
            <span class="drawer-band-title">${band.colorName || ''} · ${band.label}</span>
            <span class="drawer-band-subtitle">${band.rangeText}</span>
          </div>
        </div>
        <div class="drawer-band-right">
          ${isSelected ? '<span class="legend-band-action-pill" style="background:' + band.color + '; color:#fff;">ACTIVO</span>' : ''}
          <span class="legend-band-count">${band.count}</span>
        </div>
      `;

      const checkbox = item.querySelector('.drawer-color-check');
      const toggleColor = () => {
        mapManager.toggleBand(band.index, state.activeGroups, false);
        renderDrawerBands();
        renderTotalLegend();
        renderRouteList();
        renderDrawerRoutes();
        updateFilterBadges();
      };

      item.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        toggleColor();
      });

      checkbox.addEventListener('change', () => {
        toggleColor();
      });

      container.appendChild(item);
    });

    updateCustomCategoryUI();
    updateLimitsEditorUI();
  }

  // Render Route Explorer in Hamburger Drawer
  function renderDrawerRoutes() {
    if (!elements.drawerRouteList) return;
    const filterTerm = (elements.drawerRouteSearch?.value || '').trim().toLowerCase();
    elements.drawerRouteList.innerHTML = '';

    const hasGroupFilter = state.activeGroups.size > 0;
    const hasColorFilter = Boolean(mapManager.activeBands && mapManager.activeBands.size > 0);
    const hasAnyFilter = hasGroupFilter || hasColorFilter;

    const visibleRoutes = state.routes.filter(r => {
      if (!hasAnyFilter) return false;
      if (hasGroupFilter && !state.activeGroups.has(r.grupo)) return false;
      if (hasColorFilter && !mapManager.isRouteInActiveBands(r)) return false;
      if (!filterTerm) return true;
      const textMatch = `${r.ciudad1} ${r.provincia1} ${r.ciudad2} ${r.grupo}`.toLowerCase();
      return textMatch.includes(filterTerm);
    });

    if (elements.drawerRoutesSummary) {
      elements.drawerRoutesSummary.textContent = `${visibleRoutes.length} rutas visibles`;
    }

    if (visibleRoutes.length === 0) {
      elements.drawerRouteList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">
          ${!hasAnyFilter ? 'No hay filtros seleccionados.<br>Activa un grupo o categoría de color para ver sus rutas.' : 'No hay rutas para mostrar con los filtros actuales.'}
        </div>
      `;
      return;
    }

    visibleRoutes.forEach(r => {
      const color = mapManager.getColorForRoute(r);
      const pkgs = r.total_packages !== undefined ? r.total_packages : 0;
      const band = mapManager.getBandForTotal(pkgs);
      const card = document.createElement('div');
      card.className = 'drawer-route-card';
      card.setAttribute('data-id', r.id);
      card.innerHTML = `
        <div class="route-card-top">
          <span class="route-group-tag" style="background: ${color};">${r.grupo}</span>
          <span class="route-packages-tag" style="color: ${band.color}; font-weight:700; font-size:11.5px;">
            <i class="fa-solid fa-boxes-stacked"></i> ${pkgs} bultos
          </span>
        </div>
        <div class="route-path-visual">
          <span class="city-origin">${r.ciudad1}</span>
          <i class="fa-solid fa-arrow-right-long arrow-icon"></i>
          <span class="city-dest">${r.ciudad2}</span>
        </div>
        <div class="route-geo-preview">
          📍 ${r.provincia1 ? r.provincia1 + ' | ' : ''}${r.distance_km} km
        </div>
      `;

      card.addEventListener('click', () => {
        selectRouteCard(r.id);
        mapManager.focusRoute(r.id);
        if (window.innerWidth <= 900) {
          closeHamburgerDrawer();
        }
      });

      elements.drawerRouteList.appendChild(card);
    });
  }

  // Apply group filter changes
  function applyGroupFilters() {
    renderGroupSelector();
    renderDrawerGroups();
    const visibleCount = mapManager.filterByGroups(state.activeGroups);
    renderRouteList();
    renderDrawerRoutes();
    renderTotalLegend();
    renderDrawerBands();
    if (elements.visibleRoutesCount) elements.visibleRoutesCount.textContent = visibleCount;
    if (elements.drawerRoutesSummary) elements.drawerRoutesSummary.textContent = `${visibleCount} rutas visibles`;
    updateFilterBadges();
  }

  // Helper to toggle routes corresponding to the selected heat map color (multi-color supported)
  function selectHeatmapColor(bandIndex) {
    if (bandIndex === null) {
      mapManager.selectAllBands(state.activeGroups);
      showToast('Mostrando todas las rutas (filtro de color restablecido)', 'info');
    } else {
      mapManager.toggleBand(bandIndex, state.activeGroups, false);
      const isNowActive = mapManager.activeBands.has(bandIndex);
      const b = mapManager.totalBands.find(x => x.index === bandIndex);
      if (b) {
        showToast(isNowActive ? `Filtro activado: ${b.colorName} (${b.label})` : `Filtro desactivado: ${b.colorName}`, 'info');
      }
    }
    renderTotalLegend();
    renderDrawerBands();
    renderRouteList();
    renderDrawerRoutes();
    updateFilterBadges();
  }

  // Render 5-Band Total Legend
  function renderTotalLegend() {
    const container = document.getElementById('legend-bands-list');
    const summary = document.getElementById('legend-total-summary');
    const resetBtn = document.getElementById('btn-reset-band-filter');
    const filterBanner = document.getElementById('legend-filter-banner');
    const bannerDot = document.getElementById('banner-dot');
    const bannerColorName = document.getElementById('banner-color-name');
    if (!container) return;

    const bands = mapManager.totalBands || [];
    container.innerHTML = '';

    const activeBands = mapManager.activeBands || new Set();
    const hasFilter = activeBands.size > 0;
    container.classList.toggle('has-active-filter', hasFilter);

    if (filterBanner) {
      if (hasFilter) {
        filterBanner.style.display = 'flex';
        const activeNames = [];
        let firstColor = '#818CF8';
        bands.forEach(b => {
          if (activeBands.has(b.index)) {
            activeNames.push(b.colorName || b.label);
            firstColor = b.color;
          }
        });
        if (activeBands.has('custom')) {
          activeNames.push('Personalizado');
          firstColor = mapManager.customFilterCategory?.color || '#A855F7';
        }
        filterBanner.style.setProperty('--banner-color', firstColor);
        if (bannerDot) bannerDot.style.backgroundColor = firstColor;
        if (bannerColorName) bannerColorName.textContent = activeNames.join(', ');
      } else {
        filterBanner.style.display = 'none';
      }
    }

    // Render from highest band to lowest band
    bands.slice().reverse().forEach(band => {
      const isSelected = activeBands.has(band.index);
      const item = document.createElement('div');
      item.className = `legend-band-item ${isSelected ? 'active-filter' : ''}`;
      item.style.setProperty('--item-color', band.color);
      item.style.setProperty('--item-color-glow', `${band.color}55`);

      item.innerHTML = `
        <div class="legend-band-left">
          <input type="checkbox" class="drawer-color-check" ${isSelected ? 'checked' : ''} style="accent-color: ${band.color}; cursor: pointer;">
          <span class="legend-band-chip" style="background-color: ${band.color}; color: ${band.color};"></span>
          <span class="legend-band-name">${band.colorName || ''} · ${band.label}</span>
          <span class="legend-band-range">(${band.rangeText})</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          ${isSelected ? '<span class="legend-band-action-pill" style="background:' + band.color + '; color:#fff;">ACTIVO</span>' : ''}
          <span class="legend-band-count">${band.count}</span>
        </div>
      `;

      const checkbox = item.querySelector('.drawer-color-check');
      const toggleColor = () => {
        selectHeatmapColor(band.index);
      };

      item.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        toggleColor();
      });

      checkbox.addEventListener('change', () => {
        toggleColor();
      });

      container.appendChild(item);
    });

    if (resetBtn) {
      resetBtn.style.display = hasFilter ? 'inline-block' : 'none';
    }

    if (summary) {
      summary.textContent = hasFilter
        ? `${activeBands.size} categoría(s) de color activa(s)`
        : `${state.routes.length} rutas analizadas`;
    }
  }

  // Render Routes Drawer List
  function renderRouteList() {
    const filterTerm = (elements.routeSearchInput.value || '').trim().toLowerCase();
    elements.routeListBody.innerHTML = '';

    const hasGroupFilter = state.activeGroups.size > 0;
    const hasColorFilter = Boolean(mapManager.activeBands && mapManager.activeBands.size > 0);
    const hasAnyFilter = hasGroupFilter || hasColorFilter;

    const visibleRoutes = state.routes.filter(r => {
      if (!hasAnyFilter) return false;
      if (hasGroupFilter && !state.activeGroups.has(r.grupo)) return false;
      if (hasColorFilter && !mapManager.isRouteInActiveBands(r)) return false;
      if (!filterTerm) return true;
      const textMatch = `${r.ciudad1} ${r.provincia1} ${r.ciudad2} ${r.grupo}`.toLowerCase();
      return textMatch.includes(filterTerm);
    });

    elements.visibleRoutesCount.textContent = visibleRoutes.length;

    if (visibleRoutes.length === 0) {
      elements.routeListBody.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 12px;">
          ${!hasAnyFilter ? 'No hay filtros activos.<br>Selecciona un grupo o color para ver sus rutas.' : 'No hay rutas para mostrar con los filtros actuales.'}
        </div>
      `;
      return;
    }

    visibleRoutes.forEach(r => {
      const color = mapManager.getColorForRoute(r);
      const pkgs = r.total_packages !== undefined ? r.total_packages : 0;
      const band = mapManager.getBandForTotal(pkgs);
      const card = document.createElement('div');
      card.className = 'route-card';
      card.setAttribute('data-id', r.id);
      card.innerHTML = `
        <div class="route-card-top">
          <span class="route-group-tag" style="background: ${color};">${r.grupo}</span>
          <span class="route-packages-tag" style="color: ${band.color}; font-weight:700; font-size:11.5px;">
            <i class="fa-solid fa-boxes-stacked"></i> ${pkgs} bultos [${band.label}]
          </span>
        </div>
        <div class="route-path-visual">
          <span class="city-origin">${r.ciudad1}</span>
          <i class="fa-solid fa-arrow-right-long arrow-icon"></i>
          <span class="city-dest">${r.ciudad2}</span>
        </div>
        <div class="route-geo-preview">
          📍 ${r.provincia1 ? r.provincia1 + ' | ' : ''}${r.distance_km} km
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

  // --- Draggable & Collapsible Floating Windows ---

  function makeDraggable(element, handle) {
    if (!element || !handle) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerDown = (e) => {
      // Don't initiate drag if clicking buttons, inputs, links, or interactive child items
      if (e.target.closest('button, input, select, a, .style-btn, .control-toggle-btn, .tag-btn, .window-collapse-btn, .group-checkbox')) {
        return;
      }

      if (e.type === 'mousedown' && e.button !== 0) return;

      isDragging = true;

      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;

      const container = document.querySelector('.map-workspace') || document.body;
      const containerRect = container.getBoundingClientRect();
      const elemRect = element.getBoundingClientRect();

      initialLeft = elemRect.left - containerRect.left;
      initialTop = elemRect.top - containerRect.top;

      // Lock to explicit left & top (clear bottom/right so dragging doesn't jump)
      element.style.left = `${initialLeft}px`;
      element.style.top = `${initialTop}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';

      element.classList.add('is-dragging');
      document.body.style.userSelect = 'none';

      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;

      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      const container = document.querySelector('.map-workspace') || document.body;
      const containerRect = container.getBoundingClientRect();

      const elemWidth = element.offsetWidth;
      const elemHeight = element.offsetHeight;

      const minLeft = 6;
      const maxLeft = Math.max(minLeft, containerRect.width - elemWidth - 6);
      const minTop = 6;
      const maxTop = Math.max(minTop, containerRect.height - elemHeight - 6);

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
      newTop = Math.max(minTop, Math.min(newTop, maxTop));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;

      e.preventDefault();
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      element.classList.remove('is-dragging');
      document.body.style.userSelect = '';

      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: true });
  }

  function setupCollapsibleWindow(windowElem, collapseBtn, headerElem) {
    if (!windowElem) return;

    const toggle = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      windowElem.classList.toggle('collapsed');
    };

    if (collapseBtn) {
      collapseBtn.addEventListener('click', toggle);
    }

    if (headerElem) {
      headerElem.addEventListener('dblclick', (e) => {
        if (e.target.closest('button, input, select, a, .group-checkbox')) return;
        toggle(e);
      });
    }
  }

  // 1. Group Selector Card
  const groupSelectorOverlay = document.getElementById('group-selector-overlay');
  const groupSelectorHeader = document.getElementById('group-selector-header');
  const btnCollapseGroupSelector = document.getElementById('btn-collapse-group-selector');
  makeDraggable(groupSelectorOverlay, groupSelectorHeader);
  setupCollapsibleWindow(groupSelectorOverlay, btnCollapseGroupSelector, groupSelectorHeader);

  // 2. Map Top Controls Toolbar
  const mapTopControls = document.getElementById('map-top-controls');
  const btnCollapseMapControls = document.getElementById('btn-collapse-map-controls');
  makeDraggable(mapTopControls, mapTopControls);
  setupCollapsibleWindow(mapTopControls, btnCollapseMapControls, mapTopControls);

  // 3. Route Explorer Drawer
  const routeExplorerDrawer = document.getElementById('route-explorer-drawer');
  const drawerHeader = document.getElementById('drawer-header');
  const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
  makeDraggable(routeExplorerDrawer, drawerHeader);
  setupCollapsibleWindow(routeExplorerDrawer, drawerToggleBtn, drawerHeader);

  // 4. Total 5-Band Legend Card Overlay
  const totalLegendOverlay = document.getElementById('total-legend-overlay');
  const totalLegendHeader = document.getElementById('total-legend-header');
  const btnCollapseTotalLegend = document.getElementById('btn-collapse-total-legend');
  makeDraggable(totalLegendOverlay, totalLegendHeader);
  setupCollapsibleWindow(totalLegendOverlay, btnCollapseTotalLegend, totalLegendHeader);

  // Reset band filter buttons
  const btnResetBandFilter = document.getElementById('btn-reset-band-filter');
  if (btnResetBandFilter) {
    btnResetBandFilter.addEventListener('click', () => selectHeatmapColor(null));
  }

  const btnClearColorBanner = document.getElementById('btn-clear-color-banner');
  if (btnClearColorBanner) {
    btnClearColorBanner.addEventListener('click', () => selectHeatmapColor(null));
  }

  // Values / Totals markers on trajectories toggle (ON / OFF)
  const btnToggleValues = document.getElementById('btn-toggle-values');
  if (btnToggleValues) {
    btnToggleValues.addEventListener('click', () => {
      const isShowing = mapManager.toggleValues();
      btnToggleValues.classList.toggle('active', isShowing);
      const statusPill = btnToggleValues.querySelector('.toggle-pill-status');
      if (statusPill) {
        statusPill.textContent = isShowing ? 'ON' : 'OFF';
        statusPill.classList.toggle('off', !isShowing);
      }
      if (elements.btnDrawerToggleValues) {
        elements.btnDrawerToggleValues.classList.toggle('active', isShowing);
      }
      showToast(isShowing ? 'Etiquetas de totales VISIBLES en las trayectorias' : 'Etiquetas de totales OCULTAS en el mapa', 'info');
    });
  }

  // Heat Map Layer Toggle (ON / OFF)
  const btnToggleHeatmap = document.getElementById('btn-toggle-heatmap');
  if (btnToggleHeatmap) {
    btnToggleHeatmap.addEventListener('click', () => {
      const isHeat = mapManager.toggleHeatmap();
      btnToggleHeatmap.classList.toggle('active', isHeat);
      const pill = btnToggleHeatmap.querySelector('.toggle-pill-status');
      if (pill) {
        pill.textContent = isHeat ? 'ON' : 'OFF';
        pill.classList.toggle('off', !isHeat);
      }
      showToast(isHeat ? 'Mapa de Calor de concentración de bultos ACTIVADO' : 'Mapa de Calor DESACTIVADO', 'info');
    });
  }

  // Color Mode Switcher Toggle (Total 5 Bands vs Grupo)
  const btnToggleColorMode = document.getElementById('btn-toggle-colormode');
  if (btnToggleColorMode) {
    btnToggleColorMode.addEventListener('click', () => {
      const newMode = mapManager.colorMode === 'total' ? 'group' : 'total';
      mapManager.setColorMode(newMode);
      const label = document.getElementById('colormode-label');
      if (label) {
        label.textContent = newMode === 'total' ? 'Color: Total (5B)' : 'Color: Grupo';
      }
      btnToggleColorMode.classList.toggle('active', newMode === 'total');
      renderRouteList();
      renderGroupSelector();
      renderTotalLegend();
      showToast(newMode === 'total' ? 'Rutas coloreadas según Total (5 bandas)' : 'Rutas coloreadas por Grupo operativo', 'info');
    });
  }

  // Google Sheet synchronization button
  if (elements.btnSyncSheet) {
    elements.btnSyncSheet.addEventListener('click', async () => {
      try {
        elements.btnSyncSheet.disabled = true;
        elements.btnSyncSheet.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
        const res = await API.syncGoogleSheet();
        showToast(res.message || 'Datos y bultos sincronizados desde Google Sheets', 'success');
        await refreshData(false);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        elements.btnSyncSheet.disabled = false;
        elements.btnSyncSheet.innerHTML = '<i class="fa-solid fa-rotate"></i> <span>Sincronizar Sheet</span>';
      }
    });
  }

  // Base map style switcher buttons
  document.querySelectorAll('.map-top-controls .style-btn, .map-style-switcher .style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const styleKey = btn.getAttribute('data-style');
      mapManager.setTileStyle(styleKey);
      const matchingDrawerTile = document.querySelector(`.drawer-style-tile[data-style="${styleKey}"]`);
      if (matchingDrawerTile) {
        document.querySelectorAll('.drawer-style-tile').forEach(t => t.classList.remove('active'));
        matchingDrawerTile.classList.add('active');
      }
    });
  });

  // --- Hamburger Drawer Open/Close & Navigation ---

  function openHamburgerDrawer() {
    if (elements.hamburgerDrawer) {
      elements.hamburgerDrawer.classList.add('open');
      elements.hamburgerDrawer.setAttribute('aria-hidden', 'false');
    }
    if (elements.hamburgerBackdrop) {
      elements.hamburgerBackdrop.classList.add('open');
    }
    document.body.style.overflow = 'hidden';
  }

  function closeHamburgerDrawer() {
    if (elements.hamburgerDrawer) {
      elements.hamburgerDrawer.classList.remove('open');
      elements.hamburgerDrawer.setAttribute('aria-hidden', 'true');
    }
    if (elements.hamburgerBackdrop) {
      elements.hamburgerBackdrop.classList.remove('open');
    }
    document.body.style.overflow = '';
  }

  if (elements.btnHamburger) {
    elements.btnHamburger.addEventListener('click', openHamburgerDrawer);
  }
  if (elements.btnCloseHamburger) {
    elements.btnCloseHamburger.addEventListener('click', closeHamburgerDrawer);
  }
  if (elements.hamburgerBackdrop) {
    elements.hamburgerBackdrop.addEventListener('click', closeHamburgerDrawer);
  }
  if (elements.btnDrawerApplyView) {
    elements.btnDrawerApplyView.addEventListener('click', () => {
      closeHamburgerDrawer();
      mapManager.fitVisible();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHamburgerDrawer();
    }
  });

  // Drawer Tabs navigation
  document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.drawer-tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Drawer group search input listener
  if (elements.drawerGroupSearch) {
    elements.drawerGroupSearch.addEventListener('input', () => {
      renderDrawerGroups();
    });
  }

  // Drawer route search input listener
  if (elements.drawerRouteSearch) {
    elements.drawerRouteSearch.addEventListener('input', () => {
      renderDrawerRoutes();
    });
  }

  // Drawer quick group buttons
  if (elements.btnDrawerSelectAllGroups) {
    elements.btnDrawerSelectAllGroups.addEventListener('click', () => {
      state.groups.forEach(g => state.activeGroups.add(g.grupo));
      applyGroupFilters();
      showToast('Todos los grupos seleccionados', 'info');
    });
  }

  if (elements.btnDrawerClearGroups) {
    elements.btnDrawerClearGroups.addEventListener('click', () => {
      state.activeGroups.clear();
      applyGroupFilters();
      showToast('Selección limpiada. Mostrando solo ciudades.', 'info');
    });
  }

  if (elements.btnDrawerFit) {
    elements.btnDrawerFit.addEventListener('click', () => {
      mapManager.fitVisible();
    });
  }

  if (elements.btnDrawerClearBand) {
    elements.btnDrawerClearBand.addEventListener('click', () => {
      selectHeatmapColor(null);
    });
  }

  // Drawer quick color actions
  const btnSelectAllColors = document.getElementById('btn-drawer-select-all-colors');
  if (btnSelectAllColors) {
    btnSelectAllColors.addEventListener('click', () => {
      mapManager.selectAllBands(state.activeGroups);
      renderDrawerBands();
      renderTotalLegend();
      renderRouteList();
      renderDrawerRoutes();
      updateFilterBadges();
      showToast('Mostrando todas las categorías de color', 'info');
    });
  }

  const btnClearColors = document.getElementById('btn-drawer-clear-colors');
  if (btnClearColors) {
    btnClearColors.addEventListener('click', () => {
      mapManager.selectAllBands(state.activeGroups);
      renderDrawerBands();
      renderTotalLegend();
      renderRouteList();
      renderDrawerRoutes();
      updateFilterBadges();
      showToast('Filtro de colores restablecido', 'info');
    });
  }

  // Custom Category Filter
  const checkCustomCat = document.getElementById('check-custom-cat');
  if (checkCustomCat) {
    checkCustomCat.addEventListener('change', () => {
      mapManager.toggleBand('custom', state.activeGroups, false);
      renderDrawerBands();
      renderTotalLegend();
      renderRouteList();
      renderDrawerRoutes();
      updateFilterBadges();
      const isActive = mapManager.activeBands.has('custom');
      showToast(isActive ? 'Filtro de categoría personalizada activado' : 'Filtro personalizado desactivado', 'info');
    });
  }

  const btnApplyCustomCat = document.getElementById('btn-apply-custom-cat');
  if (btnApplyCustomCat) {
    btnApplyCustomCat.addEventListener('click', () => {
      const minVal = Number(document.getElementById('custom-cat-min')?.value || 0);
      const maxVal = Number(document.getElementById('custom-cat-max')?.value || 100);
      mapManager.setCustomCategoryRange(minVal, maxVal, state.routes, state.activeGroups);
      if (!mapManager.activeBands.has('custom')) {
        mapManager.activeBands.add('custom');
      }
      mapManager.applyColorAndGroupFilters(state.activeGroups);
      renderDrawerBands();
      renderTotalLegend();
      renderRouteList();
      renderDrawerRoutes();
      updateFilterBadges();
      showToast(`Rango personalizado aplicado: ${minVal} - ${maxVal} bultos (${mapManager.customFilterCategory.count} rutas)`, 'info');
    });
  }

  // Limits Editor Toggle
  const btnToggleLimits = document.getElementById('btn-toggle-limits-editor');
  const limitsPanel = document.getElementById('limits-editor-panel');
  const limitsArrow = document.getElementById('limits-arrow');
  if (btnToggleLimits && limitsPanel) {
    btnToggleLimits.addEventListener('click', () => {
      const isHidden = limitsPanel.style.display === 'none';
      limitsPanel.style.display = isHidden ? 'flex' : 'none';
      if (limitsArrow) limitsArrow.classList.toggle('open', isHidden);
    });
  }

  // Live update for Muy Alto label as Alto (Máx) is edited
  const inputLimitB4 = document.getElementById('limit-val-b4');
  const labelMuyAlto = document.getElementById('limit-critico-label');
  if (inputLimitB4 && labelMuyAlto) {
    inputLimitB4.addEventListener('input', () => {
      const val = Number(inputLimitB4.value || 0);
      labelMuyAlto.textContent = `Desde ${val + 1} bultos`;
    });
  }

  // Limits Editor Save
  const btnSaveLimits = document.getElementById('btn-save-limits');
  if (btnSaveLimits) {
    btnSaveLimits.addEventListener('click', () => {
      const b1 = Number(document.getElementById('limit-val-b1')?.value || 5);
      const b2 = Number(document.getElementById('limit-val-b2')?.value || 15);
      const b4 = Number(document.getElementById('limit-val-b4')?.value || 45);
      if (b2 <= b1 || b4 <= b2) {
        showToast('Los límites deben ser crecientes: Bajo < Medio < Alto', 'warning');
        return;
      }
      mapManager.setCustomBandLimits({ b1, b2, b4 }, state.routes, state.activeGroups);
      renderDrawerBands();
      renderTotalLegend();
      renderRouteList();
      renderDrawerRoutes();
      showToast('Nuevos límites de categorías aplicados exitosamente', 'info');
    });
  }

  // Limits Editor Reset
  const btnResetLimits = document.getElementById('btn-reset-limits');
  if (btnResetLimits) {
    btnResetLimits.addEventListener('click', () => {
      mapManager.resetBandLimitsToAuto(state.routes, state.activeGroups);
      renderDrawerBands();
      renderTotalLegend();
      renderRouteList();
      renderDrawerRoutes();
      showToast('Límites restablecidos al cálculo automático', 'info');
    });
  }

  // Drawer switch: Totals
  if (elements.btnDrawerToggleValues) {
    elements.btnDrawerToggleValues.addEventListener('click', () => {
      const isShowing = mapManager.toggleValues();
      elements.btnDrawerToggleValues.classList.toggle('active', isShowing);
      if (btnToggleValues) {
        btnToggleValues.classList.toggle('active', isShowing);
        const statusPill = btnToggleValues.querySelector('.toggle-pill-status');
        if (statusPill) {
          statusPill.textContent = isShowing ? 'ON' : 'OFF';
          statusPill.classList.toggle('off', !isShowing);
        }
      }
      showToast(isShowing ? 'Etiquetas de totales VISIBLES' : 'Etiquetas de totales OCULTAS', 'info');
    });
  }

  // Drawer switch: Heatmap
  if (elements.btnDrawerToggleHeatmap) {
    elements.btnDrawerToggleHeatmap.addEventListener('click', () => {
      const isHeat = mapManager.toggleHeatmap();
      elements.btnDrawerToggleHeatmap.classList.toggle('active', isHeat);
      if (btnToggleHeatmap) {
        btnToggleHeatmap.classList.toggle('active', isHeat);
        const pill = btnToggleHeatmap.querySelector('.toggle-pill-status');
        if (pill) {
          pill.textContent = isHeat ? 'ON' : 'OFF';
          pill.classList.toggle('off', !isHeat);
        }
      }
      showToast(isHeat ? 'Mapa de Calor ACTIVADO' : 'Mapa de Calor DESACTIVADO', 'info');
    });
  }

  // Drawer toggle: Color Mode
  if (elements.btnDrawerToggleColorMode) {
    elements.btnDrawerToggleColorMode.addEventListener('click', () => {
      const newMode = mapManager.colorMode === 'total' ? 'group' : 'total';
      mapManager.setColorMode(newMode);
      if (elements.drawerColorModeDesc) {
        elements.drawerColorModeDesc.textContent = newMode === 'total' ? 'Por Total de Bultos (5 Bandas)' : 'Por Grupo Operativo';
      }
      const label = document.getElementById('colormode-label');
      if (label) label.textContent = newMode === 'total' ? 'Color: Total (5B)' : 'Color: Grupo';
      if (btnToggleColorMode) btnToggleColorMode.classList.toggle('active', newMode === 'total');
      renderRouteList();
      renderDrawerRoutes();
      renderGroupSelector();
      renderDrawerGroups();
      renderTotalLegend();
      renderDrawerBands();
      showToast(newMode === 'total' ? 'Color por Total (5 bandas)' : 'Color por Grupo', 'info');
    });
  }

  // Drawer style tiles
  document.querySelectorAll('.drawer-style-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      document.querySelectorAll('.drawer-style-tile').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      tile.classList.add('active');
      const styleKey = tile.getAttribute('data-style');
      const matchingDesktopBtn = document.querySelector(`.style-btn[data-style="${styleKey}"]`);
      if (matchingDesktopBtn) matchingDesktopBtn.classList.add('active');
      mapManager.setTileStyle(styleKey);
    });
  });

  // Drawer action buttons
  if (elements.btnDrawerSync) {
    elements.btnDrawerSync.addEventListener('click', () => {
      closeHamburgerDrawer();
      if (elements.btnSyncSheet) elements.btnSyncSheet.click();
    });
  }
  if (elements.btnDrawerUpload) {
    elements.btnDrawerUpload.addEventListener('click', () => {
      closeHamburgerDrawer();
      openModal();
    });
  }
  if (elements.btnDrawerSample) {
    elements.btnDrawerSample.addEventListener('click', () => {
      closeHamburgerDrawer();
      if (elements.btnLoadSample) elements.btnLoadSample.click();
    });
  }
  if (elements.btnDrawerClear) {
    elements.btnDrawerClear.addEventListener('click', () => {
      closeHamburgerDrawer();
      if (elements.btnClearRoutes) elements.btnClearRoutes.click();
    });
  }

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
    activateAndFocusRoute: (id, grupo) => {
      if (grupo && !state.activeGroups.has(grupo)) {
        state.activeGroups.add(grupo);
        applyGroupFilters();
      }
      selectRouteCard(id);
      mapManager.focusRoute(id);
      if (window.innerWidth <= 900) {
        closeHamburgerDrawer();
      }
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

/**
 * Map Engine using Leaflet.js
 * Credifin Routes Visualizer - Optimized for Unique City Nodes, Real Road Trajectories,
 * Anti-Collision Total Tags, 5-Band Total Coloring, and Interactive Heat Map.
 */
class RoutesMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.tileLayers = {};
    this.currentTileLayer = null;
    
    // Layers storage
    this.routeLayers = []; // { id, grupo, polyline, valMarker, valCoord, route, isVisible, originKey, destKey, band }
    this.cityMarkers = new Map(); // key -> { marker, cityData, isVisible }
    this.showValues = false; // Toggle for showing package quantities on trajectories (OFF by default)
    this.selectedRouteId = null; // Currently selected route ID
    this.highlightColor = '#FFE600'; // High-contrast electric yellow highlight color
    
    // Color Mode: 'total' (default 5 bands) or 'group'
    this.colorMode = 'total';
    this.totalBands = [];
    this.activeBandIndex = null; // For legacy/single-band compatibility
    this.activeBands = new Set(); // Multi-color selection: Set of band indices (0..4) and/or 'custom'
    this.customBandLimits = null; // { b1, b2, b4 } customized thresholds
    this.bandLimits = { b1: 5, b2: 15, b4: 45 }; // Currently active limits
    this.customFilterCategory = {
      min: 10,
      max: 100,
      color: '#A855F7',
      colorName: 'Púrpura',
      label: 'Personalizado',
      count: 0
    };
    
    // Heat Map
    this.showHeatmap = false;
    this.heatLayer = null;
    
    // Group Color Palette
    this.colorPalette = [
      '#6366F1', // Indigo
      '#10B981', // Emerald
      '#F59E0B', // Amber
      '#06B6D4', // Cyan
      '#EC4899', // Pink
      '#8B5CF6', // Purple
      '#14B8A6', // Teal
      '#F97316', // Orange
      '#3B82F6', // Blue
      '#84CC16'  // Lime
    ];
    this.groupColorMap = {};

    this.initMap();
  }

  initMap() {
    // Center of Argentina as default view
    this.map = L.map(this.containerId, {
      center: [-33.50, -63.50],
      zoom: 6,
      zoomControl: false
    });

    // Move zoom control to bottom-left
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    // Tile providers (100% Free - No API Key Required)
    const esriDarkBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxNativeZoom: 16,
      maxZoom: 19
    });
    const esriDarkRef = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxNativeZoom: 16,
      maxZoom: 19
    });

    this.tileLayers = {
      dark: L.layerGroup([esriDarkBase, esriDarkRef]),
      voyager: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
        maxNativeZoom: 18,
        maxZoom: 19
      })
    };

    // Default to dark theme
    this.currentTileLayer = this.tileLayers.dark;
    this.currentTileLayer.addTo(this.map);

    // Event listener: Resolve tag collisions dynamically on zoom and pan
    let collisionTimer = null;
    const scheduleCollisionResolution = () => {
      if (!this.showValues) return;
      if (collisionTimer) cancelAnimationFrame(collisionTimer);
      collisionTimer = requestAnimationFrame(() => {
        this.resolveTagCollisions();
      });
    };

    this.map.on('zoomend', scheduleCollisionResolution);
    this.map.on('moveend', scheduleCollisionResolution);
  }

  setTileStyle(styleKey) {
    if (this.tileLayers[styleKey] && this.currentTileLayer !== this.tileLayers[styleKey]) {
      this.map.removeLayer(this.currentTileLayer);
      this.currentTileLayer = this.tileLayers[styleKey];
      this.currentTileLayer.addTo(this.map);
      // Bring heat layer to front if active
      if (this.showHeatmap && this.heatLayer && this.map.hasLayer(this.heatLayer)) {
        this.heatLayer.bringToFront();
      }
    }
  }

  getColorForGroup(grupo) {
    if (!this.groupColorMap[grupo]) {
      const idx = Object.keys(this.groupColorMap).length % this.colorPalette.length;
      this.groupColorMap[grupo] = this.colorPalette[idx];
    }
    return this.groupColorMap[grupo];
  }

  /**
   * Compute 5 adaptive color bands based on the distribution of Total packages.
   * Colors (Highest to Lowest):
   * Band 4 (Crítico / Muy Alto): #EF4444 (Red)
   * Band 3 (Alto):               #F97316 (Orange)
   * Band 2 (Medio):              #FACC15 (Yellow)
   * Band 1 (Bajo):               #10B981 (Green)
   * Band 0 (Sin bultos / Mín):   #06B6D4 (Cyan / Blue)
   */
  computeTotalBands(routes) {
    let b1, b2, b4;

    if (this.customBandLimits) {
      b1 = Math.max(1, Number(this.customBandLimits.b1));
      b2 = Math.max(b1 + 1, Number(this.customBandLimits.b2));
      b4 = Math.max(b2 + 1, Number(this.customBandLimits.b4));
    } else if (routes && routes.length > 0) {
      const vals = routes.map(r => Number(r.total_packages || 0));
      const positiveVals = vals.filter(v => v > 0).sort((a, b) => a - b);
      if (positiveVals.length >= 6) {
        const q1 = positiveVals[Math.floor(positiveVals.length * 0.25)];
        const q2 = positiveVals[Math.floor(positiveVals.length * 0.50)];
        const q4 = positiveVals[Math.floor(positiveVals.length * 0.85)];
        b1 = Math.max(1, q1);
        b2 = Math.max(b1 + 1, q2);
        b4 = Math.max(b2 + 1, q4);
      } else if (positiveVals.length > 0) {
        const minVal = positiveVals[0];
        const maxVal = positiveVals[positiveVals.length - 1];
        const span = Math.max(4, maxVal - minVal);
        b1 = Math.max(1, Math.round(minVal + span * 0.25));
        b2 = Math.max(b1 + 1, Math.round(minVal + span * 0.50));
        b4 = Math.max(b2 + 1, Math.round(minVal + span * 0.80));
      } else {
        b1 = 5;
        b2 = 15;
        b4 = 45;
      }
    } else {
      b1 = 5;
      b2 = 15;
      b4 = 45;
    }

    this.bandLimits = { b1, b2, b4 };

    this.totalBands = [
      { index: 0, label: 'Sin bultos', rangeText: '0 bultos', min: 0, max: 0, color: '#06B6D4', colorName: 'Cian', count: 0 },
      { index: 1, label: 'Bajo', rangeText: `1 - ${b1} bultos`, min: 1, max: b1, color: '#10B981', colorName: 'Verde', count: 0 },
      { index: 2, label: 'Medio', rangeText: `${b1 + 1} - ${b2} bultos`, min: b1 + 1, max: b2, color: '#FACC15', colorName: 'Amarillo', count: 0 },
      { index: 3, label: 'Alto', rangeText: `${b2 + 1} - ${b4} bultos`, min: b2 + 1, max: b4, color: '#F97316', colorName: 'Naranja', count: 0 },
      { index: 4, label: 'Muy Alto', rangeText: `Desde ${b4 + 1} bultos`, min: b4 + 1, max: Infinity, color: '#EF4444', colorName: 'Rojo', count: 0 }
    ];

    if (routes && routes.length > 0) {
      // Compute route count per band
      routes.forEach(r => {
        const band = this.getBandForTotal(r.total_packages || 0);
        band.count++;
      });

      // Compute count for custom filter category
      if (this.customFilterCategory) {
        this.customFilterCategory.count = routes.filter(r => {
          const pkgs = Number(r.total_packages || 0);
          return pkgs >= this.customFilterCategory.min && pkgs <= this.customFilterCategory.max;
        }).length;
      }
    }

    return this.totalBands;
  }

  getBandForTotal(pkgs) {
    const p = Number(pkgs || 0);
    if (!this.totalBands || this.totalBands.length === 0) {
      this.computeTotalBands([]);
    }
    if (p <= 0) return this.totalBands[0];
    for (let i = this.totalBands.length - 1; i >= 1; i--) {
      if (p >= this.totalBands[i].min) {
        return this.totalBands[i];
      }
    }
    return this.totalBands[1];
  }

  /**
   * Evaluates whether a route matches the currently selected color bands and/or custom category.
   * If no color filter is selected (activeBands is empty), returns true.
   */
  isRouteInActiveBands(route) {
    if (!this.activeBands || this.activeBands.size === 0) return true;
    const pkgs = Number(route.total_packages || 0);
    const standardBand = this.getBandForTotal(pkgs);
    if (this.activeBands.has(standardBand.index)) return true;
    if (this.activeBands.has('custom') && this.customFilterCategory) {
      if (pkgs >= this.customFilterCategory.min && pkgs <= this.customFilterCategory.max) {
        return true;
      }
    }
    return false;
  }

  getColorForRoute(route) {
    if (this.colorMode === 'total') {
      const band = this.getBandForTotal(route.total_packages || 0);
      return band.color;
    }
    return this.getColorForGroup(route.grupo);
  }

  setColorMode(mode) {
    this.colorMode = mode === 'group' ? 'group' : 'total';
    this.routeLayers.forEach(item => {
      const color = this.getColorForRoute(item.route);
      const band = this.getBandForTotal(item.route.total_packages || 0);
      item.band = band;
      if (this.selectedRouteId !== item.id) {
        item.polyline.setStyle({ color: color });
      }
      if (item.valMarker) {
        const el = item.valMarker.getElement();
        if (el) {
          const badge = el.querySelector('.trajectory-val-badge');
          const dot = el.querySelector('.trajectory-band-dot');
          if (badge) badge.style.borderColor = color;
          if (dot) dot.style.backgroundColor = color;
        }
      }
    });
    return this.colorMode;
  }

  getCityKey(lat, lon, name) {
    // Deduplicate by 4 decimal coordinates precision (~11 meters) to guarantee exact 1:1 city match
    const rLat = Number(lat).toFixed(4);
    const rLon = Number(lon).toFixed(4);
    const cleanName = (name || '').trim().toLowerCase();
    return `${cleanName}_${rLat}_${rLon}`;
  }

  createCityIcon(cityName, activeCount, color) {
    return L.divIcon({
      className: 'custom-city-pin-container',
      html: `
        <div class="city-pin-wrapper">
          <div class="city-pin-node" style="border-color: ${color}; box-shadow: 0 0 16px ${color}88;">
            <div class="city-pin-inner" style="background-color: ${color};"></div>
          </div>
          <div class="city-pin-label">${cityName}</div>
        </div>
      `,
      iconSize: [80, 42],
      iconAnchor: [40, 21],
      popupAnchor: [0, -18]
    });
  }

  /**
   * Calculates a coordinate along a trajectory polyline with target fraction and lateral perpendicular shift.
   * This ensures bidirectional routes (e.g. A->B vs B->A) or shared segments are naturally separated geographically.
   */
  getPointAlongPath(points, fraction = 0.5, lateralOffsetDeg = 0) {
    if (!points || points.length === 0) return null;
    if (points.length === 1) return points[0];
    if (points.length === 2) {
      let lat = points[0][0] + (points[1][0] - points[0][0]) * fraction;
      let lon = points[0][1] + (points[1][1] - points[0][1]) * fraction;
      if (lateralOffsetDeg !== 0) {
        const dx = points[1][1] - points[0][1];
        const dy = points[1][0] - points[0][0];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        lat += ny * lateralOffsetDeg;
        lon += nx * lateralOffsetDeg;
      }
      return [lat, lon];
    }

    // Cumulative distances along road geometry points
    let totalDist = 0;
    const dists = [0];
    for (let i = 1; i < points.length; i++) {
      const dlat = points[i][0] - points[i - 1][0];
      const dlon = points[i][1] - points[i - 1][1];
      const d = Math.hypot(dlat, dlon);
      totalDist += d;
      dists.push(totalDist);
    }

    const clampedFrac = Math.min(Math.max(fraction, 0.15), 0.85);
    const targetDist = totalDist * clampedFrac;

    let segIdx = 1;
    while (segIdx < dists.length && dists[segIdx] < targetDist) {
      segIdx++;
    }
    if (segIdx >= dists.length) segIdx = dists.length - 1;

    const pPrev = points[segIdx - 1];
    const pNext = points[segIdx];
    const segLen = dists[segIdx] - dists[segIdx - 1];
    const segFrac = segLen > 0 ? (targetDist - dists[segIdx - 1]) / segLen : 0;

    let lat = pPrev[0] + (pNext[0] - pPrev[0]) * segFrac;
    let lon = pPrev[1] + (pNext[1] - pPrev[1]) * segFrac;

    if (lateralOffsetDeg !== 0) {
      const dx = pNext[1] - pPrev[1];
      const dy = pNext[0] - pPrev[0];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      lat += ny * lateralOffsetDeg;
      lon += nx * lateralOffsetDeg;
    }

    return [lat, lon];
  }

  formatCityShort(name) {
    if (!name) return '???';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '???';
    if (words.length === 1) {
      const w = words[0];
      if (w.length <= 3) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1, 3).toLowerCase();
    }
    return words.map(w => w.charAt(0).toUpperCase()).join('');
  }

  createValueMarker(route, coord, color, band) {
    if (!coord) return null;
    const pkgs = route.total_packages !== undefined ? route.total_packages : 0;
    const c1Code = this.formatCityShort(route.ciudad1);
    const c2Code = this.formatCityShort(route.ciudad2);
    const labelText = `${c1Code} ➔ ${c2Code} (${pkgs})`;
    const bandColor = (band && band.color) ? band.color : color;

    const icon = L.divIcon({
      className: 'custom-trajectory-val-container',
      html: `
        <div class="trajectory-dist-badge trajectory-val-badge" style="border-color: ${bandColor};" data-route-id="${route.id}" title="Ruta: ${route.ciudad1} ➔ ${route.ciudad2} | Total: ${pkgs} bultos [${band ? band.label : ''}]">
          <span class="trajectory-band-dot" style="background-color: ${bandColor};"></span>
          <span class="trajectory-route-label">${labelText}</span>
        </div>
      `,
      iconSize: [100, 24],
      iconAnchor: [50, 12]
    });

    const marker = L.marker(coord, { icon, zIndexOffset: 250 });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      this.focusRoute(route.id);
    });
    return marker;
  }

  toggleValues(forceState = null) {
    if (forceState !== null) {
      this.showValues = Boolean(forceState);
    } else {
      this.showValues = !this.showValues;
    }

    this.routeLayers.forEach(item => {
      if (!item.valMarker) return;
      if (this.showValues && item.isVisible) {
        if (!this.map.hasLayer(item.valMarker)) {
          item.valMarker.addTo(this.map);
        }
      } else {
        if (this.map.hasLayer(item.valMarker)) {
          this.map.removeLayer(item.valMarker);
        }
      }
    });

    if (this.showValues) {
      setTimeout(() => this.resolveTagCollisions(), 60);
    }

    return this.showValues;
  }

  /**
   * Screen-space Anti-Collision Relaxation Engine.
   * Scans all visible total tags in screen space. If two or more badge bounding boxes
   * collide or overlap, smooth vertical offsets are applied so tags stack cleanly without overlapping.
   */
  resolveTagCollisions() {
    if (!this.map || !this.showValues) return;

    const visibleItems = this.routeLayers.filter(item => item.isVisible && item.valMarker && this.map.hasLayer(item.valMarker));
    if (visibleItems.length <= 1) return;

    const markerBoxes = [];
    for (const item of visibleItems) {
      const latLng = item.valCoord || item.valMarker.getLatLng();
      const pt = this.map.latLngToContainerPoint(latLng);
      const el = item.valMarker.getElement();
      const inner = el ? el.querySelector('.trajectory-val-badge') : null;
      markerBoxes.push({
        item,
        inner,
        x: pt.x,
        y: pt.y,
        shiftX: 0,
        shiftY: 0,
        w: 104, // badge width + padding
        h: 26   // badge height + padding
      });
    }

    // Run 5 relaxation passes
    const iterations = 5;
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < markerBoxes.length; i++) {
        const a = markerBoxes[i];
        const ax = a.x + a.shiftX;
        const ay = a.y + a.shiftY;

        for (let j = i + 1; j < markerBoxes.length; j++) {
          const b = markerBoxes[j];
          const bx = b.x + b.shiftX;
          const by = b.y + b.shiftY;

          const dx = ax - bx;
          const dy = ay - by;
          const overlapX = a.w - Math.abs(dx);
          const overlapY = a.h - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            // Collision detected! Push apart along vertical Y axis (since badges are horizontal pills)
            const pushY = (overlapY / 2) + 2;
            if (dy >= 0) {
              a.shiftY += pushY;
              b.shiftY -= pushY;
            } else {
              a.shiftY -= pushY;
              b.shiftY += pushY;
            }
          }
        }
      }
    }

    // Apply smooth transform shift to inner badge DOM
    for (const mb of markerBoxes) {
      if (mb.inner) {
        if (mb.shiftX !== 0 || mb.shiftY !== 0) {
          mb.inner.style.transform = `translate(${Math.round(mb.shiftX)}px, ${Math.round(mb.shiftY)}px)`;
        } else {
          mb.inner.style.transform = '';
        }
      }
    }
  }

  /**
   * Heat Map Layer Toggle and Management using Leaflet.heat
   */
  toggleHeatmap(forceState = null) {
    if (forceState !== null) {
      this.showHeatmap = Boolean(forceState);
    } else {
      this.showHeatmap = !this.showHeatmap;
    }

    if (this.showHeatmap) {
      this.updateHeatmapLayer();
    } else {
      if (this.heatLayer && this.map.hasLayer(this.heatLayer)) {
        this.map.removeLayer(this.heatLayer);
      }
    }

    return this.showHeatmap;
  }

  updateHeatmapLayer() {
    if (!this.showHeatmap) return;
    if (this.heatLayer && this.map.hasLayer(this.heatLayer)) {
      this.map.removeLayer(this.heatLayer);
    }
    if (typeof L.heatLayer !== 'function') {
      console.warn('L.heatLayer plugin is not loaded yet.');
      return;
    }

    const heatPoints = [];
    let maxPkgs = 10;

    this.routeLayers.forEach(item => {
      if (!item.isVisible) return;
      const pkgs = Number(item.route.total_packages || 0);
      if (pkgs <= 0) return;
      if (pkgs > maxPkgs) maxPkgs = pkgs;

      const points = item.route.geometry && item.route.geometry.length >= 2
        ? item.route.geometry
        : [[item.route.lat1, item.route.lon1], [item.route.lat2, item.route.lon2]];

      // Sample along trajectory
      const step = Math.max(1, Math.floor(points.length / 8));
      for (let i = 0; i < points.length; i += step) {
        heatPoints.push([points[i][0], points[i][1], pkgs * 0.75]);
      }
      // Node hubs
      heatPoints.push([item.route.lat1, item.route.lon1, pkgs]);
      heatPoints.push([item.route.lat2, item.route.lon2, pkgs]);
    });

    if (heatPoints.length === 0) return;

    this.heatLayer = L.heatLayer(heatPoints, {
      radius: 34,
      blur: 24,
      maxZoom: 12,
      max: maxPkgs,
      minOpacity: 0.38,
      gradient: {
        0.15: '#06B6D4',
        0.35: '#10B981',
        0.55: '#FACC15',
        0.75: '#F97316',
        1.00: '#EF4444'
      }
    });

    this.heatLayer.addTo(this.map);
  }

  buildCityPopupHtml(city, activeGroupsSet = null) {
    const hasFilter = activeGroupsSet && activeGroupsSet.size > 0;
    const activeOut = hasFilter ? city.outgoing.filter(r => activeGroupsSet.has(r.grupo)) : city.outgoing;
    const activeIn = hasFilter ? city.incoming.filter(r => activeGroupsSet.has(r.grupo)) : city.incoming;
    const totalCount = activeOut.length + activeIn.length;

    // Collect distinct groups
    const groupsSet = new Set();
    activeOut.forEach(r => groupsSet.add(r.grupo));
    activeIn.forEach(r => groupsSet.add(r.grupo));

    const groupPillsHtml = Array.from(groupsSet).map(g => {
      const col = this.getColorForGroup(g);
      return `<span class="popup-group-pill" style="background:${col};">${g}</span>`;
    }).join(' ');

    let outRoutesHtml = '';
    if (activeOut.length > 0) {
      outRoutesHtml = `
        <div class="city-popup-section-title">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Salidas hacia (${activeOut.length})
        </div>
        <div class="city-popup-routes-list">
          ${activeOut.map(r => {
            const col = this.getColorForRoute(r);
            const pkgs = r.total_packages !== undefined ? r.total_packages : 0;
            const band = this.getBandForTotal(pkgs);
            return `
              <div class="city-route-item" onclick="window.RoutesApp && window.RoutesApp.activateAndFocusRoute(${r.id}, '${r.grupo}')">
                <div class="city-route-header">
                  <span class="city-route-dest">➔ <strong>${r.ciudad2}</strong></span>
                  <span class="city-route-pkgs" style="color: ${band.color}; font-weight:700; font-size:11.5px;">
                    <i class="fa-solid fa-boxes-stacked"></i> ${pkgs} bultos
                  </span>
                </div>
                <div class="city-route-meta">
                  <span class="city-route-group" style="color: ${col}; border-color: ${col}44;">${r.grupo}</span>
                  <span class="city-route-dist" style="color: #94A3B8; font-size:10.5px;">${r.distance_km} km</span>
                  <span class="city-route-action">Ver ruta <i class="fa-solid fa-chevron-right"></i></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    let inRoutesHtml = '';
    if (activeIn.length > 0) {
      inRoutesHtml = `
        <div class="city-popup-section-title" style="margin-top: 10px;">
          <i class="fa-solid fa-arrow-down-left-and-up-right-to-center"></i> Conexiones de llegada (${activeIn.length})
        </div>
        <div class="city-popup-routes-list">
          ${activeIn.map(r => {
            const col = this.getColorForRoute(r);
            const pkgs = r.total_packages !== undefined ? r.total_packages : 0;
            const band = this.getBandForTotal(pkgs);
            return `
              <div class="city-route-item" onclick="window.RoutesApp && window.RoutesApp.activateAndFocusRoute(${r.id}, '${r.grupo}')">
                <div class="city-route-header">
                  <span class="city-route-dest">⬅️ Desde <strong>${r.ciudad1}</strong></span>
                  <span class="city-route-pkgs" style="color: ${band.color}; font-weight:700; font-size:11.5px;">
                    <i class="fa-solid fa-boxes-stacked"></i> ${pkgs} bultos
                  </span>
                </div>
                <div class="city-route-meta">
                  <span class="city-route-group" style="color: ${col}; border-color: ${col}44;">${r.grupo}</span>
                  <span class="city-route-dist" style="color: #94A3B8; font-size:10.5px;">${r.distance_km} km</span>
                  <span class="city-route-action">Ver ruta <i class="fa-solid fa-chevron-right"></i></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="popup-city-card">
        <div class="city-popup-header">
          <div class="city-popup-title-row">
            <span class="city-popup-icon"><i class="fa-solid fa-location-dot"></i></span>
            <div>
              <h3>${city.name}</h3>
              <div class="city-popup-province">${city.provincia ? city.provincia : 'Argentina'}</div>
            </div>
          </div>
          <span class="city-popup-count-badge">${totalActive} ${totalActive === 1 ? 'ruta' : 'rutas'}</span>
        </div>

        <div class="city-popup-groups-row">
          ${groupPillsHtml}
        </div>

        <div class="city-popup-coord-pill">
          <span>Lat: ${city.lat.toFixed(5)}</span> | <span>Lon: ${city.lon.toFixed(5)}</span>
        </div>

        <div class="city-popup-scrollable">
          ${outRoutesHtml}
          ${inRoutesHtml}
        </div>
      </div>
    `;
  }

  renderRoutes(routes, activeGroupsSet = null) {
    // Clear all existing layers
    this.clearMapLayers();

    if (!routes || routes.length === 0) return;

    // 1. Calculate 5 Total Bands
    this.computeTotalBands(routes);

    const bounds = L.latLngBounds([]);

    // 2. Group routes by unique cities
    const citiesMap = new Map();
    routes.forEach(route => {
      // Origin city
      const originKey = this.getCityKey(route.lat1, route.lon1, route.ciudad1);
      if (!citiesMap.has(originKey)) {
        citiesMap.set(originKey, {
          key: originKey,
          name: route.ciudad1,
          provincia: route.provincia1 || '',
          lat: route.lat1,
          lon: route.lon1,
          outgoing: [],
          incoming: [],
          groups: new Set()
        });
      }
      const originCity = citiesMap.get(originKey);
      originCity.outgoing.push(route);
      originCity.groups.add(route.grupo);

      // Destination city
      const destKey = this.getCityKey(route.lat2, route.lon2, route.ciudad2);
      if (!citiesMap.has(destKey)) {
        citiesMap.set(destKey, {
          key: destKey,
          name: route.ciudad2,
          provincia: '',
          lat: route.lat2,
          lon: route.lon2,
          outgoing: [],
          incoming: [],
          groups: new Set()
        });
      }
      const destCity = citiesMap.get(destKey);
      destCity.incoming.push(route);
      destCity.groups.add(route.grupo);
    });

    // 3. Corridor grouping for Anti-Collision trajectory tag placement
    const corridorMap = new Map();
    routes.forEach(route => {
      const c1 = (route.ciudad1 || '').trim().toLowerCase();
      const c2 = (route.ciudad2 || '').trim().toLowerCase();
      const corrKey = c1 < c2 ? `${c1}__${c2}` : `${c2}__${c1}`;
      if (!corridorMap.has(corrKey)) {
        corridorMap.set(corrKey, []);
      }
      corridorMap.get(corrKey).push(route);
    });

    // Compute corridor position map for each route id
    const routeCorridorPlacement = new Map();
    corridorMap.forEach((corridorRoutes) => {
      const N = corridorRoutes.length;
      corridorRoutes.forEach((route, idx) => {
        let fraction = 0.50;
        let lateralOffset = 0;
        if (N === 2) {
          fraction = idx === 0 ? 0.38 : 0.62;
          lateralOffset = (idx === 0 ? 1 : -1) * 0.00030; // ~30m lateral shift
        } else if (N > 2) {
          fraction = 0.28 + (idx / (N - 1)) * 0.44;
          lateralOffset = (idx % 2 === 0 ? 1 : -1) * 0.00030;
        }
        routeCorridorPlacement.set(route.id, { fraction, lateralOffset });
      });
    });

    // 4. Render Road Trajectories (Polylines + Value Tags with 5-Band Colors)
    const hasGroupFilter = Boolean(activeGroupsSet && activeGroupsSet.size > 0);
    const hasColorFilter = Boolean(this.activeBands && this.activeBands.size > 0);
    const hasAnyFilter = hasGroupFilter || hasColorFilter;

    routes.forEach(route => {
      let isVisible = false;
      if (hasAnyFilter) {
        const matchesGroup = !hasGroupFilter || (activeGroupsSet && activeGroupsSet.has(route.grupo));
        const matchesColor = !hasColorFilter || this.isRouteInActiveBands(route);
        isVisible = matchesGroup && matchesColor;
      }

      const band = this.getBandForTotal(route.total_packages || 0);
      const color = this.getColorForRoute(route);

      // Extract geometry along real roads
      const hasRoadGeometry = Array.isArray(route.geometry) && route.geometry.length >= 2;
      const points = hasRoadGeometry ? route.geometry : [[route.lat1, route.lon1], [route.lat2, route.lon2]];

      // Polyline width: higher volume routes get slightly more prominent weight
      const pkgs = route.total_packages !== undefined ? route.total_packages : 0;
      let polyWeight = 3.5;
      if (band.index === 4) polyWeight = 4.8;
      else if (band.index === 3) polyWeight = 4.2;
      else if (band.index === 2) polyWeight = 3.8;

      const polyline = L.polyline(points, {
        color: color,
        weight: polyWeight,
        opacity: 0.88,
        smoothFactor: 1
      });

      // Hover interactions
      polyline.on('mouseover', () => {
        if (this.selectedRouteId === route.id) return;
        polyline.setStyle({ weight: polyWeight + 3, opacity: 1 });
        polyline.bringToFront();
      });
      polyline.on('mouseout', () => {
        if (this.selectedRouteId === route.id) return;
        polyline.setStyle({ weight: polyWeight, opacity: 0.88 });
      });

      // Tooltip with band classification and total packages
      polyline.bindTooltip(`
        <div style="font-family: Outfit, sans-serif; font-size: 12px; line-height: 1.4;">
          <div style="font-weight: 700; color: #fff; margin-bottom: 2px;">
            ${route.ciudad1} ➔ ${route.ciudad2}
          </div>
          <div style="color: ${color}; font-size: 11px; font-weight: 600;">
            Grupo: ${route.grupo} · Cat: ${band.label} (${band.colorName})
          </div>
          <div style="color: #94A3B8; font-size: 11px;">
            <i class="fa-solid fa-boxes-stacked"></i> Total: <strong>${pkgs}</strong> bultos
          </div>
        </div>
      `, { direction: 'top', sticky: true, className: 'dark-route-tooltip' });

      // Click polyline: select and highlight route
      polyline.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.selectRoute(route.id, false);
        if (window.RoutesApp && window.RoutesApp.selectRouteCard) {
          window.RoutesApp.selectRouteCard(route.id);
        }
      });

      const originKey = this.getCityKey(route.lat1, route.lon1, route.ciudad1);
      const destKey = this.getCityKey(route.lat2, route.lon2, route.ciudad2);

      // Trajectory tag placement using corridor distribution
      const placement = routeCorridorPlacement.get(route.id) || { fraction: 0.50, lateralOffset: 0 };
      const tagCoord = this.getPointAlongPath(points, placement.fraction, placement.lateralOffset);
      const valMarker = this.createValueMarker(route, tagCoord, color, band);

      const routeItem = {
        id: route.id,
        grupo: route.grupo,
        polyline,
        valMarker,
        valCoord: tagCoord,
        route,
        band,
        polyWeight,
        originKey,
        destKey,
        isVisible
      };
      this.routeLayers.push(routeItem);

      if (isVisible) {
        polyline.addTo(this.map);
        if (valMarker && this.showValues) {
          valMarker.addTo(this.map);
        }
        bounds.extend([route.lat1, route.lon1]);
        bounds.extend([route.lat2, route.lon2]);
      }
    });

    // 5. Render Deduplicated Unique City Markers
    citiesMap.forEach((city, key) => {
      let isVisible = false;
      let displayCount = 0;
      let primaryColor = '#6366F1';

      if (!hasAnyFilter) {
        // App start / no filters: all cities visible
        isVisible = true;
        displayCount = city.outgoing.length + city.incoming.length;
      } else {
        // Filter applied: only cities involved in active routes are visible
        const activeOut = city.outgoing.filter(r => {
          const matchesGroup = !hasGroupFilter || (activeGroupsSet && activeGroupsSet.has(r.grupo));
          const matchesColor = !hasColorFilter || this.isRouteInActiveBands(r);
          return matchesGroup && matchesColor;
        });
        const activeIn = city.incoming.filter(r => {
          const matchesGroup = !hasGroupFilter || (activeGroupsSet && activeGroupsSet.has(r.grupo));
          const matchesColor = !hasColorFilter || this.isRouteInActiveBands(r);
          return matchesGroup && matchesColor;
        });
        displayCount = activeOut.length + activeIn.length;
        if (displayCount > 0) {
          isVisible = true;
          const firstRoute = activeOut[0] || activeIn[0];
          primaryColor = this.getColorForRoute(firstRoute);
        }
      }

      const icon = this.createCityIcon(city.name, displayCount, primaryColor);
      const marker = L.marker([city.lat, city.lon], { icon });

      marker.bindPopup(() => this.buildCityPopupHtml(city, activeGroupsSet), {
        maxWidth: 340,
        className: 'custom-city-leaflet-popup'
      });

      marker.bindTooltip(`📍 ${city.name} (${displayCount} conexiones)`, {
        direction: 'top',
        offset: [0, -14]
      });

      this.cityMarkers.set(key, {
        marker,
        cityData: city,
        isVisible,
        primaryColor
      });

      if (isVisible) {
        marker.addTo(this.map);
        bounds.extend([city.lat, city.lon]);
      }
    });

    // Update Heat Map layer if enabled
    if (this.showHeatmap) {
      this.updateHeatmapLayer();
    }

    // Fit map bounds to encompass all visible nodes/cities
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }

    // Resolve any tag collisions in screen space
    if (this.showValues) {
      setTimeout(() => this.resolveTagCollisions(), 70);
    }
  }

  filterByGroups(activeGroupsSet) {
    const bounds = L.latLngBounds([]);
    let visibleRoutesCount = 0;
    
    const hasGroupFilter = Boolean(activeGroupsSet && activeGroupsSet.size > 0);
    const hasColorFilter = Boolean(this.activeBands && this.activeBands.size > 0);
    const hasAnyFilter = hasGroupFilter || hasColorFilter;

    // 1. Update Route Polylines & Distance Marks
    this.routeLayers.forEach(item => {
      let shouldShow = false;
      if (hasAnyFilter) {
        const matchesGroup = !hasGroupFilter || activeGroupsSet.has(item.grupo);
        const matchesColor = !hasColorFilter || this.isRouteInActiveBands(item.route);
        shouldShow = matchesGroup && matchesColor;
      }
      item.isVisible = shouldShow;

      if (shouldShow) {
        if (!this.map.hasLayer(item.polyline)) {
          item.polyline.addTo(this.map);
        }
        if (this.showValues && item.valMarker && !this.map.hasLayer(item.valMarker)) {
          item.valMarker.addTo(this.map);
        }
        bounds.extend([item.route.lat1, item.route.lon1]);
        bounds.extend([item.route.lat2, item.route.lon2]);
        visibleRoutesCount++;
      } else {
        if (this.map.hasLayer(item.polyline)) {
          this.map.removeLayer(item.polyline);
        }
        if (item.valMarker && this.map.hasLayer(item.valMarker)) {
          this.map.removeLayer(item.valMarker);
        }
      }
    });

    // 2. Update Deduplicated City Markers
    this.cityMarkers.forEach(cityItem => {
      const city = cityItem.cityData;

      if (!hasAnyFilter) {
        // App start / no filters: all cities visible
        cityItem.isVisible = true;
        const totalConn = city.outgoing.length + city.incoming.length;
        const icon = this.createCityIcon(city.name, totalConn, '#6366F1');
        cityItem.marker.setIcon(icon);
        cityItem.marker.setTooltipContent(`📍 ${city.name} (${totalConn} conexiones)`);
        if (!this.map.hasLayer(cityItem.marker)) {
          cityItem.marker.addTo(this.map);
        }
        bounds.extend([city.lat, city.lon]);
      } else {
        // Filter is active: only cities involved in active routes must be displayed!
        const activeOut = city.outgoing.filter(r => {
          const matchesGroup = !hasGroupFilter || activeGroupsSet.has(r.grupo);
          const matchesColor = !hasColorFilter || this.isRouteInActiveBands(r);
          return matchesGroup && matchesColor;
        });
        const activeIn = city.incoming.filter(r => {
          const matchesGroup = !hasGroupFilter || activeGroupsSet.has(r.grupo);
          const matchesColor = !hasColorFilter || this.isRouteInActiveBands(r);
          return matchesGroup && matchesColor;
        });
        const activeCount = activeOut.length + activeIn.length;

        if (activeCount > 0) {
          // Involved city: display on map
          cityItem.isVisible = true;
          const firstRoute = activeOut[0] || activeIn[0];
          const primaryColor = this.getColorForRoute(firstRoute);
          const newIcon = this.createCityIcon(city.name, activeCount, primaryColor);
          cityItem.marker.setIcon(newIcon);
          cityItem.marker.setTooltipContent(`📍 ${city.name} (${activeCount} conexiones activas)`);
          if (!this.map.hasLayer(cityItem.marker)) {
            cityItem.marker.addTo(this.map);
          }
          bounds.extend([city.lat, city.lon]);
        } else {
          // City not involved: DO NOT DISPLAY
          cityItem.isVisible = false;
          if (this.map.hasLayer(cityItem.marker)) {
            this.map.removeLayer(cityItem.marker);
          }
        }
      }
    });

    if (this.showHeatmap) {
      this.updateHeatmapLayer();
    }

    if (this.showValues) {
      setTimeout(() => this.resolveTagCollisions(), 60);
    }

    return visibleRoutesCount;
  }

  /**
   * Toggle a specific color band (0..4 or 'custom') in the multi-color selection.
   */
  toggleBand(bandId, activeGroupsSet = null, fitMap = false) {
    if (this.activeBands.has(bandId)) {
      this.activeBands.delete(bandId);
    } else {
      this.activeBands.add(bandId);
    }
    this.activeBandIndex = this.activeBands.size === 1 ? Array.from(this.activeBands)[0] : null;
    return this.applyColorAndGroupFilters(activeGroupsSet, fitMap);
  }

  /**
   * Select ONLY one band (exclusive color select).
   */
  selectSingleBand(bandId, activeGroupsSet = null, fitMap = false) {
    if (this.activeBands.size === 1 && this.activeBands.has(bandId)) {
      this.activeBands.clear();
    } else {
      this.activeBands.clear();
      this.activeBands.add(bandId);
    }
    this.activeBandIndex = this.activeBands.size === 1 ? Array.from(this.activeBands)[0] : null;
    return this.applyColorAndGroupFilters(activeGroupsSet, fitMap);
  }

  /**
   * Select all colors / clear color filter (all visible).
   */
  selectAllBands(activeGroupsSet = null) {
    this.activeBands.clear();
    this.activeBandIndex = null;
    return this.applyColorAndGroupFilters(activeGroupsSet, false);
  }

  /**
   * Legacy filterByBand wrapper for backward compatibility.
   */
  filterByBand(bandIndex, activeGroupsSet = null, fitMap = true) {
    return this.toggleBand(bandIndex, activeGroupsSet, fitMap);
  }

  /**
   * Sets custom limits for color bands { b1, b2, b4 } and updates map layers.
   */
  setCustomBandLimits(limits, routes, activeGroupsSet) {
    this.customBandLimits = {
      b1: Math.max(1, Number(limits.b1)),
      b2: Math.max(Number(limits.b1) + 1, Number(limits.b2)),
      b4: Math.max(Number(limits.b2) + 1, Number(limits.b4))
    };
    this.computeTotalBands(routes);
    this.refreshRouteLayerStyles();
    return this.filterByGroups(activeGroupsSet);
  }

  /**
   * Resets color limits to auto-calculated quantile values.
   */
  resetBandLimitsToAuto(routes, activeGroupsSet) {
    this.customBandLimits = null;
    this.computeTotalBands(routes);
    this.refreshRouteLayerStyles();
    return this.filterByGroups(activeGroupsSet);
  }

  /**
   * Sets custom range filter (e.g. Min 10, Max 80 packages).
   */
  setCustomCategoryRange(min, max, routes, activeGroupsSet) {
    this.customFilterCategory.min = Math.max(0, Number(min));
    this.customFilterCategory.max = Math.max(this.customFilterCategory.min, Number(max));
    if (routes) {
      this.customFilterCategory.count = routes.filter(r => {
        const pkgs = Number(r.total_packages || 0);
        return pkgs >= this.customFilterCategory.min && pkgs <= this.customFilterCategory.max;
      }).length;
    }
    return this.filterByGroups(activeGroupsSet);
  }

  /**
   * Re-evaluates color mode and polyline style for all route layers when limits change.
   */
  refreshRouteLayerStyles() {
    this.routeLayers.forEach(item => {
      const band = this.getBandForTotal(item.route.total_packages || 0);
      item.band = band;
      if (this.colorMode === 'total' && this.selectedRouteId !== item.id) {
        item.polyline.setStyle({ color: band.color });
        if (item.valMarker) {
          const el = item.valMarker.getElement();
          if (el) {
            const badge = el.querySelector('.trajectory-val-badge');
            if (badge) badge.style.borderColor = band.color;
            const dot = el.querySelector('.trajectory-band-dot');
            if (dot) dot.style.backgroundColor = band.color;
          }
        }
      }
    });
  }

  applyColorAndGroupFilters(activeGroupsSet, fitMap = false) {
    const visibleCount = this.filterByGroups(activeGroupsSet);
    if (fitMap) {
      this.fitVisible();
    }
    return {
      visibleCount,
      activeBands: Array.from(this.activeBands),
      totalBands: this.totalBands
    };
  }

  fitVisible() {
    const bounds = L.latLngBounds([]);
    let hasVisible = false;
    this.routeLayers.forEach(item => {
      if (item.isVisible) {
        bounds.extend([item.route.lat1, item.route.lon1]);
        bounds.extend([item.route.lat2, item.route.lon2]);
        hasVisible = true;
      }
    });
    if (!hasVisible) {
      this.cityMarkers.forEach(item => {
        if (item.isVisible) {
          bounds.extend([item.cityData.lat, item.cityData.lon]);
        }
      });
    }
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }

  selectRoute(routeId, flyTo = true) {
    // 1. Reset previously selected route back to its proper color
    if (this.selectedRouteId && this.selectedRouteId !== routeId) {
      const prev = this.routeLayers.find(item => item.id === this.selectedRouteId);
      if (prev && prev.polyline) {
        const prevColor = this.getColorForRoute(prev.route);
        prev.polyline.setStyle({
          color: prevColor,
          weight: prev.polyWeight || 3.5,
          opacity: 0.88
        });
      }
    }

    const found = this.routeLayers.find(item => item.id === routeId);
    if (!found) return;

    this.selectedRouteId = routeId;

    // Ensure polyline is on the map
    if (!this.map.hasLayer(found.polyline)) {
      found.polyline.addTo(this.map);
    }

    // Highlight route with distinct high-contrast colour (#FFE600 Electric Yellow)
    found.polyline.setStyle({
      color: this.highlightColor,
      weight: 7,
      opacity: 1
    });
    found.polyline.bringToFront();

    // Ensure origin & destination city markers are visible
    const originItem = this.cityMarkers.get(found.originKey);
    const destItem = this.cityMarkers.get(found.destKey);
    if (originItem && !this.map.hasLayer(originItem.marker)) originItem.marker.addTo(this.map);
    if (destItem && !this.map.hasLayer(destItem.marker)) destItem.marker.addTo(this.map);

    // Zoom and pan to route polyline if requested
    if (flyTo) {
      const rBounds = found.polyline.getBounds();
      if (rBounds.isValid()) {
        this.map.flyToBounds(rBounds, { padding: [80, 80], maxZoom: 10, duration: 0.8 });
      }
    }
  }

  focusRoute(routeId) {
    this.selectRoute(routeId, true);
    const found = this.routeLayers.find(item => item.id === routeId);
    if (found) {
      const originItem = this.cityMarkers.get(found.originKey);
      setTimeout(() => {
        if (originItem) {
          originItem.marker.openPopup();
        }
      }, 850);
    }
  }

  clearMapLayers() {
    this.selectedRouteId = null;
    this.routeLayers.forEach(item => {
      if (this.map.hasLayer(item.polyline)) this.map.removeLayer(item.polyline);
      if (item.valMarker && this.map.hasLayer(item.valMarker)) this.map.removeLayer(item.valMarker);
    });
    this.routeLayers = [];

    this.cityMarkers.forEach(item => {
      if (this.map.hasLayer(item.marker)) this.map.removeLayer(item.marker);
    });
    this.cityMarkers.clear();

    if (this.heatLayer && this.map.hasLayer(this.heatLayer)) {
      this.map.removeLayer(this.heatLayer);
    }
    this.heatLayer = null;
  }
}

// Attach to window so city popup click actions can invoke focusRoute
window.RoutesMap = RoutesMap;

/**
 * API Client for Credifin Routes Visualizer
 */
const API = {
  async getRoutes(grupo = null) {
    const url = grupo && grupo !== 'all' ? `/api/routes?grupo=${encodeURIComponent(grupo)}` : '/api/routes';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Error al obtener rutas');
    return await resp.json();
  },

  async getGroups() {
    const resp = await fetch('/api/groups');
    if (!resp.ok) throw new Error('Error al obtener grupos');
    return await resp.json();
  },

  async getStats() {
    const resp = await fetch('/api/stats');
    if (!resp.ok) throw new Error('Error al obtener estadísticas');
    return await resp.json();
  },

  async uploadCsv(file, mode = 'replace') {
    const formData = new FormData();
    formData.append('file', file);
    
    const resp = await fetch(`/api/upload?mode=${encodeURIComponent(mode)}`, {
      method: 'POST',
      body: formData
    });
    
    let data;
    try {
      data = await resp.json();
    } catch (e) {
      data = { detail: resp.statusText || 'Error de comunicación con el servidor' };
    }
    if (!resp.ok) {
      throw new Error(data.detail || 'Error al procesar el archivo CSV');
    }
    return data;
  },

  async loadSample() {
    const resp = await fetch('/api/sample', { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || 'Error al cargar datos de muestra');
    return data;
  },

  async clearRoutes() {
    const resp = await fetch('/api/routes', { method: 'DELETE' });
    if (!resp.ok) throw new Error('Error al limpiar rutas');
    return await resp.json();
  }
};

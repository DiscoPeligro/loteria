// Conexión con el servidor local: estado en vivo por SSE y acciones por POST.

export function conectar({ alRecibir, alCambiarEnlace }) {
  let es = null;
  let reintento = null;

  const abrir = () => {
    clearTimeout(reintento);
    es?.close();
    es = new EventSource('/api/stream');
    es.onopen = () => alCambiarEnlace?.(true);
    es.onmessage = (ev) => {
      try { alRecibir(JSON.parse(ev.data)); } catch (e) { console.error('estado ilegible', e); }
    };
    es.onerror = () => {
      alCambiarEnlace?.(false);
      // EventSource reintenta solo, salvo que se haya cerrado del todo (p. ej. un 404).
      if (es.readyState === EventSource.CLOSED) reintento = setTimeout(abrir, 3000);
    };
  };

  abrir();
  return { cerrar: () => { clearTimeout(reintento); es?.close(); } };
}

export async function accion(nombre, datos = {}) {
  try {
    const r = await fetch('/api/accion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: nombre, ...datos }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: 'Sin conexión con el servidor de la lotería.' };
  }
}

/** ¿Esta página la está sirviendo el servidor local? (En hosting público no hay /api.) */
export async function hayServidor() {
  try {
    const r = await fetch('/api/estado', { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d?.salidas) ? d : null;
  } catch {
    return null;
  }
}

export function leerPref(clave, porDefecto) {
  try { return localStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; }
}

export function guardarPref(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* OBS o el navegador pueden bloquear storage */ }
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);

export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') nodo.className = v;
    else if (k === 'dataset') Object.assign(nodo.dataset, v);
    else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else if (k in nodo && typeof v !== 'string') nodo[k] = v;
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) nodo.append(h);
  return nodo;
}

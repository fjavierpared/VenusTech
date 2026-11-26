// Ventanas de confirmación, aviso y pregunta con el estilo del panel
// (reemplazan confirm/alert/prompt del navegador, que muestran "venustechfp.com dice…").

type Opciones = { aceptar?: string; cancelar?: string; peligro?: boolean; titulo?: string };

let dlg: HTMLDialogElement | null = null;

function crear() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.className =
    'w-[min(92vw,28rem)] rounded-2xl border border-slate-200 bg-white p-0 text-tinta shadow-2xl backdrop:bg-navy-950/50 backdrop:backdrop-blur-[2px]';
  dlg.innerHTML = `
    <form method="dialog" class="grid gap-4 p-6">
      <h2 data-d="titulo" class="font-display text-lg font-bold text-navy-900"></h2>
      <p data-d="texto" class="text-sm leading-relaxed whitespace-pre-line text-gris"></p>
      <input data-d="campo" type="text" class="hidden w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-navy-700" />
      <div class="mt-1 flex flex-wrap justify-end gap-2">
        <button data-d="cancelar" value="no" class="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-navy-900 hover:bg-slate-50"></button>
        <button data-d="aceptar" value="si" class="rounded-full px-4 py-2 text-sm font-semibold text-white"></button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  return dlg;
}

function abrir(texto: string, o: Opciones & { campo?: { placeholder?: string; valor?: string }; soloAceptar?: boolean }) {
  const d = crear();
  const q = <T extends HTMLElement>(k: string) => d.querySelector<T>(`[data-d="${k}"]`)!;
  q('titulo').textContent = o.titulo ?? (o.peligro ? '¿Estás seguro?' : o.campo ? 'Escribe el dato' : 'Aviso');
  q('texto').textContent = texto;
  const campo = q<HTMLInputElement>('campo');
  campo.classList.toggle('hidden', !o.campo);
  campo.value = o.campo?.valor ?? '';
  campo.placeholder = o.campo?.placeholder ?? '';
  const aceptar = q<HTMLButtonElement>('aceptar');
  aceptar.textContent = o.aceptar ?? (o.soloAceptar ? 'Entendido' : 'Aceptar');
  aceptar.className = `rounded-full px-4 py-2 text-sm font-semibold text-white ${o.peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-naranja hover:bg-naranja-600'}`;
  const cancelar = q<HTMLButtonElement>('cancelar');
  cancelar.textContent = o.cancelar ?? 'Cancelar';
  cancelar.classList.toggle('hidden', !!o.soloAceptar);
  d.returnValue = '';
  d.showModal();
  (o.campo ? campo : o.soloAceptar ? aceptar : cancelar).focus();
  return new Promise<{ ok: boolean; valor: string }>((listo) =>
    d.addEventListener('close', () => listo({ ok: d.returnValue === 'si', valor: campo.value.trim() }), { once: true }),
  );
}

export const confirmar = async (texto: string, o: Opciones = {}) => (await abrir(texto, o)).ok;
export const avisar = async (texto: string, o: Opciones = {}) => {
  await abrir(texto, { ...o, soloAceptar: true });
};
export const pedir = async (texto: string, placeholder = '', o: Opciones = {}) => {
  const r = await abrir(texto, { ...o, campo: { placeholder } });
  return r.ok && r.valor ? r.valor : null;
};

/**
 * Botones o enlaces con data-confirmar="¿…?" piden confirmación antes de actuar.
 * Opcional: data-confirmar-boton="Eliminar" (texto del botón de aceptar).
 * Se considera peligroso (botón rojo) si el elemento tiene texto rojo.
 */
export function activarConfirmaciones() {
  document.addEventListener(
    'click',
    async (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-confirmar]');
      if (!el || el.dataset.confirmado === '1') return;
      e.preventDefault();
      e.stopPropagation();
      const peligro = /text-red|border-red/.test(el.className);
      const ok = await confirmar(el.dataset.confirmar!, {
        peligro,
        aceptar: el.dataset.confirmarBoton ?? (el.textContent?.trim() || 'Aceptar'),
      });
      if (!ok) return;
      if (el instanceof HTMLButtonElement && el.form) {
        el.form.requestSubmit(el);
      } else if (el instanceof HTMLAnchorElement) {
        location.href = el.href;
      } else {
        el.dataset.confirmado = '1';
        el.click();
        delete el.dataset.confirmado;
      }
    },
    true,
  );
}

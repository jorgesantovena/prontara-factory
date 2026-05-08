/**
 * Diccionario i18n de Prontara Factory (H4-I18N).
 *
 * Soporta 3 idiomas:
 *   - es (es-ES) — español, default
 *   - en (en-US) — inglés
 *   - ca (ca-ES) — catalán
 *
 * Las strings que NO estén traducidas para un idioma fallback al
 * español. Para añadir un idioma nuevo, copia el bloque "es" y
 * traduce — el helper `t` lo usará automáticamente.
 *
 * IMPORTANTE: solo se cubren las strings UI principales y de uso
 * frecuente. Para cubrir más, añadir keys aquí y reemplazar literales
 * en pages/components.
 */

export type Locale = "es" | "en" | "ca";

export const SUPPORTED_LOCALES: Locale[] = ["es", "en", "ca"];
export const DEFAULT_LOCALE: Locale = "es";

type Dictionary = Record<string, string>;

const ES: Dictionary = {
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Borrar",
  "common.edit": "Editar",
  "common.create": "Crear",
  "common.search": "Buscar",
  "common.loading": "Cargando…",
  "common.error": "Error",
  "common.success": "Hecho",
  "common.confirm": "Confirmar",
  "common.required": "obligatorio",
  "common.optional": "opcional",
  "common.actions": "Acciones",
  "common.status": "Estado",
  "common.date": "Fecha",
  "common.amount": "Importe",
  "common.client": "Cliente",
  "common.module": "Módulo",
  "common.user": "Usuario",
  "common.export": "Exportar",
  "common.import": "Importar",
  "common.filter": "Filtrar",
  "common.refresh": "Recargar",
  "common.back": "Volver",
  "common.next": "Siguiente",
  "common.previous": "Anterior",
  "common.add": "Añadir",
  "common.remove": "Quitar",
  "common.yes": "Sí",
  "common.no": "No",

  "nav.dashboard": "Panel",
  "nav.clients": "Clientes",
  "nav.invoices": "Facturas",
  "nav.quotes": "Presupuestos",
  "nav.projects": "Proyectos",
  "nav.tasks": "Tareas",
  "nav.tickets": "Tickets",
  "nav.products": "Productos",
  "nav.calendar": "Calendario",
  "nav.messages": "Mensajes",
  "nav.integrations": "Integraciones",
  "nav.reports": "Reportes",
  "nav.settings": "Ajustes",
  "nav.workflows": "Workflows",

  "auth.login": "Iniciar sesión",
  "auth.logout": "Cerrar sesión",
  "auth.email": "Correo electrónico",
  "auth.password": "Contraseña",
  "auth.mfa": "Código 2FA",
  "auth.invalidCredentials": "Credenciales inválidas",

  "kanban.title": "Vista Kanban",
  "kanban.dragHint": "Arrastra las tarjetas entre columnas para cambiar su estado.",
  "gantt.title": "Vista Gantt",
  "gantt.requiresDates": "Requiere campos fechaInicio y fechaFin.",
};

const EN: Dictionary = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.create": "Create",
  "common.search": "Search",
  "common.loading": "Loading…",
  "common.error": "Error",
  "common.success": "Done",
  "common.confirm": "Confirm",
  "common.required": "required",
  "common.optional": "optional",
  "common.actions": "Actions",
  "common.status": "Status",
  "common.date": "Date",
  "common.amount": "Amount",
  "common.client": "Client",
  "common.module": "Module",
  "common.user": "User",
  "common.export": "Export",
  "common.import": "Import",
  "common.filter": "Filter",
  "common.refresh": "Refresh",
  "common.back": "Back",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.add": "Add",
  "common.remove": "Remove",
  "common.yes": "Yes",
  "common.no": "No",

  "nav.dashboard": "Dashboard",
  "nav.clients": "Clients",
  "nav.invoices": "Invoices",
  "nav.quotes": "Quotes",
  "nav.projects": "Projects",
  "nav.tasks": "Tasks",
  "nav.tickets": "Tickets",
  "nav.products": "Products",
  "nav.calendar": "Calendar",
  "nav.messages": "Messages",
  "nav.integrations": "Integrations",
  "nav.reports": "Reports",
  "nav.settings": "Settings",
  "nav.workflows": "Workflows",

  "auth.login": "Sign in",
  "auth.logout": "Sign out",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.mfa": "2FA code",
  "auth.invalidCredentials": "Invalid credentials",

  "kanban.title": "Kanban view",
  "kanban.dragHint": "Drag cards between columns to change their state.",
  "gantt.title": "Gantt view",
  "gantt.requiresDates": "Requires fechaInicio and fechaFin fields.",
};

const CA: Dictionary = {
  "common.save": "Desa",
  "common.cancel": "Cancel·la",
  "common.delete": "Esborra",
  "common.edit": "Edita",
  "common.create": "Crea",
  "common.search": "Cerca",
  "common.loading": "Carregant…",
  "common.error": "Error",
  "common.success": "Fet",
  "common.confirm": "Confirma",
  "common.required": "obligatori",
  "common.optional": "opcional",
  "common.actions": "Accions",
  "common.status": "Estat",
  "common.date": "Data",
  "common.amount": "Import",
  "common.client": "Client",
  "common.module": "Mòdul",
  "common.user": "Usuari",
  "common.export": "Exporta",
  "common.import": "Importa",
  "common.filter": "Filtra",
  "common.refresh": "Recarrega",
  "common.back": "Torna",
  "common.next": "Següent",
  "common.previous": "Anterior",
  "common.add": "Afegeix",
  "common.remove": "Treu",
  "common.yes": "Sí",
  "common.no": "No",

  "nav.dashboard": "Tauler",
  "nav.clients": "Clients",
  "nav.invoices": "Factures",
  "nav.quotes": "Pressupostos",
  "nav.projects": "Projectes",
  "nav.tasks": "Tasques",
  "nav.tickets": "Tiquets",
  "nav.products": "Productes",
  "nav.calendar": "Calendari",
  "nav.messages": "Missatges",
  "nav.integrations": "Integracions",
  "nav.reports": "Informes",
  "nav.settings": "Configuració",
  "nav.workflows": "Fluxos",

  "auth.login": "Inicia sessió",
  "auth.logout": "Tanca sessió",
  "auth.email": "Correu electrònic",
  "auth.password": "Contrasenya",
  "auth.mfa": "Codi 2FA",
  "auth.invalidCredentials": "Credencials no vàlides",

  "kanban.title": "Vista Kanban",
  "kanban.dragHint": "Arrossega les targetes entre columnes per canviar-ne l'estat.",
  "gantt.title": "Vista Gantt",
  "gantt.requiresDates": "Requereix els camps fechaInicio i fechaFin.",
};

const DICTIONARIES: Record<Locale, Dictionary> = { es: ES, en: EN, ca: CA };

/**
 * Devuelve la traducción de `key` para `locale`. Si no existe, fallback
 * a español, y si tampoco existe devuelve la key tal cual (útil en dev
 * para detectar qué falta traducir).
 */
export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  const dict = DICTIONARIES[locale] || ES;
  return dict[key] || ES[key] || key;
}

/**
 * Devuelve un objeto con todas las strings del idioma — útil para hacer
 * un único spread en componentes cliente sin cargar el diccionario entero
 * en cada render.
 */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] || ES;
}

/**
 * Resuelve el locale de un Accept-Language header / cookie. Devuelve el
 * primer locale soportado, o DEFAULT_LOCALE si ninguno coincide.
 */
export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  const parts = input.split(",").map((p) => p.split(";")[0].trim().toLowerCase());
  for (const p of parts) {
    const short = p.split("-")[0] as Locale;
    if (SUPPORTED_LOCALES.includes(short)) return short;
  }
  return DEFAULT_LOCALE;
}

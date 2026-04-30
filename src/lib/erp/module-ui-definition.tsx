import type { ReactNode } from "react";
import type { ModuleRecord } from "@/lib/erp/module-definition";
import type {
  CrudColumn,
  LinkedSelectConfig,
  RelatedModuleConfig,
} from "@/components/erp/module-crud-page";

export type ModuleUiDefinition = {
  moduleKey: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  columns: CrudColumn[];
  linkedSelects?: LinkedSelectConfig[];
  relatedModules?: RelatedModuleConfig[];
  renderSummary?: (selected: ModuleRecord | null) => ReactNode;
};

const CLIENTES_UI_DEFINITION: ModuleUiDefinition = {
  moduleKey: "clientes",
  title: "Clientes",
  description: "Rejilla, seleccion y formulario basico del modulo de clientes.",
  searchPlaceholder: "Buscar por nombre, email, telefono, segmento...",
  columns: [
    { key: "nombre", label: "Nombre" },
    { key: "email", label: "Email" },
    { key: "telefono", label: "Telefono" },
    { key: "estado", label: "Estado" },
  ],
  relatedModules: [
    {
      key: "crm",
      label: "CRM vinculado",
      relationField: "clienteId",
      columns: [
        { key: "empresa", label: "Empresa" },
        { key: "contacto", label: "Contacto" },
        { key: "fase", label: "Fase" },
        { key: "valorEstimado", label: "Valor" },
      ],
    },
    {
      key: "presupuestos",
      label: "Presupuestos",
      relationField: "clienteId",
      columns: [
        { key: "numero", label: "Numero" },
        { key: "concepto", label: "Concepto" },
        { key: "importe", label: "Importe" },
        { key: "estado", label: "Estado" },
      ],
    },
    {
      key: "facturacion",
      label: "Facturas",
      relationField: "clienteId",
      columns: [
        { key: "numero", label: "Numero" },
        { key: "concepto", label: "Concepto" },
        { key: "importe", label: "Importe" },
        { key: "estado", label: "Estado" },
      ],
    },
  ],
  renderSummary: (selected: ModuleRecord | null) => (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Cliente seleccionado</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{selected?.nombre || "-"}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Email:</strong> {selected?.email || "-"}</div>
        <div><strong>Telefono:</strong> {selected?.telefono || "-"}</div>
        <div><strong>Estado:</strong> {selected?.estado || "-"}</div>
        <div><strong>Segmento:</strong> {selected?.segmento || "-"}</div>
        <div><strong>Ultimo contacto:</strong> {selected?.ultimoContacto || "-"}</div>
      </div>
    </div>
  ),
};

const CRM_UI_DEFINITION: ModuleUiDefinition = {
  moduleKey: "crm",
  title: "CRM",
  description: "Rejilla, formulario y enlace real con clientes.",
  searchPlaceholder: "Buscar por empresa, contacto, email, fase...",
  columns: [
    { key: "empresa", label: "Empresa" },
    { key: "contacto", label: "Contacto" },
    { key: "fase", label: "Fase" },
    { key: "valorEstimado", label: "Valor" },
  ],
  linkedSelects: [
    {
      fieldKey: "empresa",
      label: "Cliente vinculado",
      sourceModuleKey: "clientes",
      optionValueField: "id",
      optionLabelField: "nombre",
      bindIdField: "clienteId",
      bindNameField: "clienteNombre",
      autoFillMap: {
        empresa: "nombre",
        contacto: "nombre",
        email: "email",
        telefono: "telefono",
      },
    },
  ],
  renderSummary: (selected: ModuleRecord | null) => (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Oportunidad seleccionada</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{selected?.empresa || "-"}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Contacto:</strong> {selected?.contacto || "-"}</div>
        <div><strong>Email:</strong> {selected?.email || "-"}</div>
        <div><strong>Fase:</strong> {selected?.fase || "-"}</div>
        <div><strong>Valor estimado:</strong> {selected?.valorEstimado || "-"}</div>
        <div><strong>Proximo paso:</strong> {selected?.proximoPaso || "-"}</div>
      </div>
    </div>
  ),
};

const PRESUPUESTOS_UI_DEFINITION: ModuleUiDefinition = {
  moduleKey: "presupuestos",
  title: "Presupuestos",
  description: "Rejilla, formulario y enlace real con clientes y facturas.",
  searchPlaceholder: "Buscar por numero, cliente, concepto o estado...",
  columns: [
    { key: "numero", label: "Numero" },
    { key: "clienteNombre", label: "Cliente" },
    { key: "concepto", label: "Concepto" },
    { key: "estado", label: "Estado" },
  ],
  linkedSelects: [
    {
      fieldKey: "cliente",
      label: "Cliente vinculado",
      sourceModuleKey: "clientes",
      optionValueField: "id",
      optionLabelField: "nombre",
      bindIdField: "clienteId",
      bindNameField: "clienteNombre",
      autoFillMap: {
        cliente: "nombre",
      },
    },
  ],
  renderSummary: (selected: ModuleRecord | null) => (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Presupuesto seleccionado</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{selected?.numero || "-"}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Cliente:</strong> {selected?.clienteNombre || selected?.cliente || "-"}</div>
        <div><strong>Concepto:</strong> {selected?.concepto || "-"}</div>
        <div><strong>Importe:</strong> {selected?.importe || "-"}</div>
        <div><strong>Estado:</strong> {selected?.estado || "-"}</div>
        <div><strong>Valido hasta:</strong> {selected?.validoHasta || "-"}</div>
      </div>
    </div>
  ),
};

const FACTURACION_UI_DEFINITION: ModuleUiDefinition = {
  moduleKey: "facturacion",
  title: "Facturacion",
  description: "Rejilla, formulario y enlace real con clientes y presupuestos.",
  searchPlaceholder: "Buscar por numero, cliente, presupuesto, concepto o estado...",
  columns: [
    { key: "numero", label: "Numero" },
    { key: "clienteNombre", label: "Cliente" },
    { key: "presupuestoNumero", label: "Presupuesto" },
    { key: "estado", label: "Estado" },
  ],
  linkedSelects: [
    {
      fieldKey: "cliente",
      label: "Cliente vinculado",
      sourceModuleKey: "clientes",
      optionValueField: "id",
      optionLabelField: "nombre",
      bindIdField: "clienteId",
      bindNameField: "clienteNombre",
      autoFillMap: {
        cliente: "nombre",
      },
    },
    {
      fieldKey: "presupuesto",
      label: "Presupuesto relacionado",
      sourceModuleKey: "presupuestos",
      optionValueField: "id",
      optionLabelField: "numero",
      bindIdField: "presupuestoId",
      bindNameField: "presupuestoNumero",
      includeEmptyOption: true,
      emptyOptionLabel: "Sin presupuesto",
      filterByFormField: "clienteId",
      filterBySourceField: "clienteId",
      autoFillMap: {
        presupuesto: "numero",
      },
    },
  ],
  renderSummary: (selected: ModuleRecord | null) => (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Factura seleccionada</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{selected?.numero || "-"}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Cliente:</strong> {selected?.clienteNombre || selected?.cliente || "-"}</div>
        <div><strong>Presupuesto:</strong> {selected?.presupuestoNumero || selected?.presupuesto || "-"}</div>
        <div><strong>Concepto:</strong> {selected?.concepto || "-"}</div>
        <div><strong>Importe:</strong> {selected?.importe || "-"}</div>
        <div><strong>Estado:</strong> {selected?.estado || "-"}</div>
      </div>
    </div>
  ),
};

const PROYECTOS_UI_DEFINITION: ModuleUiDefinition = {
  moduleKey: "proyectos",
  title: "Proyectos",
  description: "Rejilla, formulario y enlace real con clientes.",
  searchPlaceholder: "Buscar por nombre, cliente, estado, responsable...",
  columns: [
    { key: "nombre", label: "Nombre" },
    { key: "clienteNombre", label: "Cliente" },
    { key: "estado", label: "Estado" },
    { key: "responsable", label: "Responsable" },
  ],
  linkedSelects: [
    {
      fieldKey: "cliente",
      label: "Cliente vinculado",
      sourceModuleKey: "clientes",
      optionValueField: "id",
      optionLabelField: "nombre",
      bindIdField: "clienteId",
      bindNameField: "clienteNombre",
      autoFillMap: {
        cliente: "nombre",
      },
    },
  ],
  renderSummary: (selected: ModuleRecord | null) => (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Proyecto seleccionado</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{selected?.nombre || "-"}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Cliente:</strong> {selected?.clienteNombre || selected?.cliente || "-"}</div>
        <div><strong>Estado:</strong> {selected?.estado || "-"}</div>
        <div><strong>Responsable:</strong> {selected?.responsable || "-"}</div>
        <div><strong>Prioridad:</strong> {selected?.prioridad || "-"}</div>
        <div><strong>Presupuesto:</strong> {selected?.presupuesto || "-"}</div>
      </div>
    </div>
  ),
};

const DOCUMENTOS_UI_DEFINITION: ModuleUiDefinition = {
  moduleKey: "documentos",
  title: "Documentos",
  description: "Rejilla y formulario basico del modulo de documentos.",
  searchPlaceholder: "Buscar por nombre, tipo, entidad o estado...",
  columns: [
    { key: "nombre", label: "Nombre" },
    { key: "tipo", label: "Tipo" },
    { key: "entidad", label: "Entidad" },
    { key: "estado", label: "Estado" },
  ],
  renderSummary: (selected: ModuleRecord | null) => (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Documento seleccionado</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{selected?.nombre || "-"}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Tipo:</strong> {selected?.tipo || "-"}</div>
        <div><strong>Entidad:</strong> {selected?.entidad || "-"}</div>
        <div><strong>Entidad ID:</strong> {selected?.entidadId || "-"}</div>
        <div><strong>Estado:</strong> {selected?.estado || "-"}</div>
        <div><strong>Fecha:</strong> {selected?.fecha || "-"}</div>
      </div>
    </div>
  ),
};

const AJUSTES_UI_DEFINITION: ModuleUiDefinition = {
  moduleKey: "ajustes",
  title: "Ajustes",
  description: "Rejilla y formulario basico del modulo de ajustes.",
  searchPlaceholder: "Buscar por nombre, valor o descripcion...",
  columns: [
    { key: "nombre", label: "Nombre" },
    { key: "valor", label: "Valor" },
    { key: "descripcion", label: "Descripcion" },
  ],
  renderSummary: (selected: ModuleRecord | null) => (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Ajuste seleccionado</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{selected?.nombre || "-"}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Valor:</strong> {selected?.valor || "-"}</div>
        <div><strong>Descripcion:</strong> {selected?.descripcion || "-"}</div>
      </div>
    </div>
  ),
};

const MODULE_UI_DEFINITIONS: Record<string, ModuleUiDefinition> = {
  clientes: CLIENTES_UI_DEFINITION,
  crm: CRM_UI_DEFINITION,
  presupuestos: PRESUPUESTOS_UI_DEFINITION,
  facturacion: FACTURACION_UI_DEFINITION,
  proyectos: PROYECTOS_UI_DEFINITION,
  documentos: DOCUMENTOS_UI_DEFINITION,
  ajustes: AJUSTES_UI_DEFINITION,
};

export function getModuleUiDefinition(moduleKey: string): ModuleUiDefinition | null {
  return MODULE_UI_DEFINITIONS[moduleKey] || null;
}

export function listModuleUiDefinitions(): ModuleUiDefinition[] {
  return Object.values(MODULE_UI_DEFINITIONS);
}
"use client";

import ModuleCrudPage from "@/components/erp/module-crud-page";
import { getModuleUiDefinition } from "@/lib/erp/module-ui-definition";

export default function AjustesPage() {
  const definition = getModuleUiDefinition("ajustes");

  if (!definition) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>Ajustes</h1>
        <p>No existe definicion UI para este modulo.</p>
      </main>
    );
  }

  return (
    <ModuleCrudPage
      moduleKey={definition.moduleKey}
      title={definition.title}
      description={definition.description}
      searchPlaceholder={definition.searchPlaceholder}
      columns={definition.columns}
      linkedSelects={definition.linkedSelects}
      relatedModules={definition.relatedModules}
      renderSummary={definition.renderSummary}
    />
  );
}
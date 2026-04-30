export type ErpRequestOptions = {
  includeSampleData: boolean;
  requestInstaller: boolean;
};

export function parseErpRequestOptions(prompt: string): ErpRequestOptions {
  const text = prompt.trim().toLowerCase();

  const includeSampleData =
    text.includes("datos de muestra") ||
    text.includes("con datos de muestra") ||
    text.includes("datos demo") ||
    text.includes("con demo") ||
    text.includes("sample data") ||
    text.includes("demo data");

  const requestInstaller =
    text.includes("instalable") ||
    text.includes("instalador") ||
    text.includes("exe") ||
    text.includes("desktop") ||
    text.includes("escritorio");

  return {
    includeSampleData,
    requestInstaller,
  };
}

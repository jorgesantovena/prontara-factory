import type {
  GenerationAssemblyResult,
  RuntimeComposableBlueprint,
} from "@/lib/factory/blueprint-definition";
import { composeRuntimeConfigFromBlueprint } from "@/lib/factory/runtime-config-composer";

export function assembleGenerationFromBlueprint(
  blueprint: RuntimeComposableBlueprint
): GenerationAssemblyResult {
  const runtimeConfig = composeRuntimeConfigFromBlueprint(blueprint);

  return {
    ok: true,
    blueprint,
    runtimeConfig,
    summary: {
      moduleCount: blueprint.modules.length,
      enabledModuleCount: runtimeConfig.enabledModuleKeys.length,
      entityCount: blueprint.entities.length,
      flowCount: blueprint.flows.length,
      dashboardPriorityCount: blueprint.dashboardPriorities.length,
      landingRuleCount: blueprint.landingRules.length,
      demoDataModuleCount: Object.keys(runtimeConfig.demoDataByModule).length,
    },
  };
}
/**
 * Единая точка динамического импорта WorkflowSection: нужна и для React.lazy,
 * и для prefetch со страницы comparison (тот же URL чанка в бандле Vite).
 */
export function loadWorkflowSectionModule() {
  return import('../components/WorkflowSection.jsx')
}

export function preloadWorkflowSection() {
  void loadWorkflowSectionModule()
}

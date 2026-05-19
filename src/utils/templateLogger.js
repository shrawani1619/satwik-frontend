/**
 * Browser console helper — mirrors backend `[template]` logs.
 */
export function logTemplateUsage(info = {}) {
  const { channel = 'unknown', templateName = '(unnamed)', ...rest } = info;
  console.log('[template]', { channel, templateName, ...rest });
}

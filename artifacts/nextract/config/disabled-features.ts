/**
 * Features deliberately disabled for the client-facing visual editor.
 * true: text/image/video edits only; page structure and styling stay locked.
 * Also hides the canvas device/zoom toolbar and the Mobile canvas shortcut.
 * The CMS section list uses the same flag to lock section/list structure.
 * false: restore the Content / Design switch and all design tools.
 * Reload the editor after changing this file in development.
 * Rebuild/restart the site for the change to take effect in production.
 */
export const disabledFeatures = {
  visualBuilderDesign: false,
};

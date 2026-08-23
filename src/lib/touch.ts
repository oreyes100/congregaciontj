// Detección temprana de dispositivos táctiles — corre inline en <head> antes
// del primer paint (sin FOUC, mismo patrón que themeInitScript) y agrega
// clases al <html>:
//   touch-device → puntero grueso táctil (pointer: coarse + touch),
//                  iOS (incluye iPadOS 13+, que se hace pasar por Mac)
//                  o Android
//   ios / android → ajustes específicos por plataforma
// macOS/Windows/Linux con mouse no reciben clases → UI de escritorio intacta.
export const touchInitScript = `
(function () {
  try {
    var ua = navigator.userAgent || '';
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    var iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    var ios = /iPad|iPhone|iPod/.test(ua) || iPadOS;
    var android = /Android/.test(ua);
    var de = document.documentElement;
    if ((touch && coarse) || ios || android) de.classList.add('touch-device');
    if (ios) de.classList.add('ios');
    if (android) de.classList.add('android');
  } catch (e) {}
})();
`;

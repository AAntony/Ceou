import type { ErrorUtils as ErrorUtilsType } from 'react-native';
import { logClientError } from './errorLogging';

// `ErrorUtils` est un global RN (pas un export nommé du package — seul son
// TYPE est réexporté par 'react-native'), câblé par le runtime avant même le
// premier require. Capte les exceptions JS non rattrapées ailleurs
// (event handlers, code async...) — complète l'ErrorBoundary React, qui ne
// voit que les erreurs de rendu. On log PUIS on redonne la main au handler
// par défaut (celui qui affiche le RedBox en dev / gère le crash en prod) :
// jamais question de le remplacer silencieusement.
export function installGlobalErrorHandler(): void {
  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsType }).ErrorUtils;
  if (!errorUtils) return;

  const defaultHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    logClientError(error, { isFatal, source: 'global_handler' });
    defaultHandler(error, isFatal);
  });
}

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { logClientError } from '../lib/errorLogging';

// Les Error Boundaries React n'existent qu'en composant classe (aucune API
// hooks équivalente) — d'où ce mélange classe (capture) + fonction
// (rendu du repli, pour pouvoir utiliser useTranslation).
function ErrorBoundaryFallback() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-sand px-6">
      <Text className="text-center text-body font-semibold text-ink">{t('common.error_boundary_title')}</Text>
      <Text className="mt-2 text-center text-label text-ink-soft">{t('common.error_boundary_hint')}</Text>
    </View>
  );
}

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

// Ne capte que les erreurs de RENDU de l'arbre React sous elle (constructeurs,
// lifecycle, render) — les erreurs d'event handlers/code async sont hors de
// sa portée par conception React, couvertes séparément par
// installGlobalErrorHandler (voir globalErrorHandler.ts).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logClientError(error, { componentStack: info.componentStack, source: 'error_boundary' });
  }

  render() {
    if (this.state.hasError) return <ErrorBoundaryFallback />;
    return this.props.children;
  }
}

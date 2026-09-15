import { useTranslation } from 'react-i18next';
import { CodeScanner } from '../../components/CodeScanner';

type QrScannerProps = { visible: boolean; onClose: () => void; onScanned: (data: string) => void; hint?: string };

export function QrScanner({ hint, ...props }: QrScannerProps) {
  const { t } = useTranslation();
  return <CodeScanner {...props} barcodeTypes={['qr']} hint={hint ?? t('friends.scan_hint')}
    permissionMessage={t('friends.scan_permission_message')} />;
}

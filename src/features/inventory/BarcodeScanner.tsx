import { useTranslation } from 'react-i18next';
import { CodeScanner } from '../../components/CodeScanner';

type BarcodeScannerProps = { visible: boolean; onClose: () => void; onScanned: (code: string) => void };

export function BarcodeScanner(props: BarcodeScannerProps) {
  const { t } = useTranslation();
  return <CodeScanner {...props} barcodeTypes={['ean13', 'ean8', 'upc_a', 'upc_e']}
    hint={t('inventory.objet.scan_hint')} permissionMessage={t('inventory.objet.scan_permission_message')} />;
}

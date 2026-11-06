import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radius } from '@/constants/theme';

// O site gera o código com crypto.randomUUID: outros QR codes são recusados sem chamar a API.
const FORMATO_CODIGO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  visivel: boolean;
  onLido: (codigo: string) => void;
  onFechar: () => void;
};

export function QrScannerModal({ visivel, onLido, onFechar }: Props) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [aviso, setAviso] = useState('');
  // A câmera dispara o evento várias vezes por segundo: só o primeiro código válido conta.
  const jaLeu = useRef(false);

  useEffect(() => {
    if (!visivel) return;
    jaLeu.current = false;
    setAviso('');
    if (permissao && !permissao.granted && permissao.canAskAgain) pedirPermissao();
  }, [visivel, permissao, pedirPermissao]);

  function handleLeitura({ data }: BarcodeScanningResult) {
    if (jaLeu.current) return;
    const codigo = data.trim();
    if (!FORMATO_CODIGO.test(codigo)) {
      setAviso('Este QR code não é do painel dos pais.');
      return;
    }
    jaLeu.current = true;
    onLido(codigo);
  }

  const negada = permissao !== null && !permissao.granted && !permissao.canAskAgain;

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <View style={styles.root}>
        {permissao?.granted && visivel && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleLeitura}
          />
        )}

        <View style={styles.conteudo}>
          <Text style={styles.titulo}>Escanear QR code</Text>
          {negada ? (
            <View style={styles.bloco}>
              <Text style={styles.texto}>
                Para ler o QR code, libere a câmera nas configurações do celular. Se preferir, cole o código na tela anterior.
              </Text>
              <Pressable
                onPress={() => Linking.openSettings()}
                style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}>
                <Text style={styles.botaoTexto}>Abrir configurações</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.mira} />
              <Text style={styles.texto}>
                {aviso || 'Aponte para o QR code que aparece em "Conectar celular", no painel dos pais.'}
              </Text>
            </>
          )}
          <Pressable
            onPress={onFechar}
            accessibilityRole="button"
            style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}>
            <IconSymbol name="xmark" size={18} color="#F8FAFC" />
            <Text style={styles.botaoTexto}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Cores fixas: o texto fica sempre sobre a imagem da câmera, nos dois temas.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  conteudo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    gap: 20,
  },
  titulo: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },
  bloco: { alignItems: 'center', gap: 16 },
  mira: { width: 240, height: 240, borderWidth: 3, borderColor: '#F8FAFC', borderRadius: Radius.card },
  texto: {
    color: '#F8FAFC',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: Radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: '#F8FAFC',
    borderRadius: Radius.control,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  botaoTexto: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  pressionado: { opacity: 0.6 },
});

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { ApiError, completePair } from '@/lib/api';
import { colors } from '@/lib/colors';
import { parsePairUrl } from '@/lib/pairing';
import { useSession } from '@/lib/session';

export default function PairScreen() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const [permission, requestPermission] = useCameraPermissions();
  const [deviceName, setDeviceName] = useState('iPhone');
  const [manualUrl, setManualUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard against the camera firing onBarcodeScanned multiple times for the
  // same code while the request is in flight.
  const scannedRef = useRef(false);

  async function handlePair(host: string, token: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await completePair(host, token, deviceName.trim() || 'Mobile');
      await setSession({
        host,
        bearer: res.bearer,
        deviceId: res.device_id,
        deviceName: res.device_name,
      });
      router.replace('/');
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? `${e.message} — is the desktop reachable at this address?`
            : 'Pair failed';
      setError(msg);
      scannedRef.current = false;
      setBusy(false);
    }
  }

  function handleBarcode({ data }: { data: string }) {
    if (scannedRef.current) return;
    const payload = parsePairUrl(data);
    if (!payload) return;
    scannedRef.current = true;
    void handlePair(payload.host, payload.token);
  }

  function handleManualPair() {
    const payload = parsePairUrl(manualUrl);
    if (!payload) {
      setError("That doesn't look like a Voicebox pairing URL.");
      return;
    }
    void handlePair(payload.host, payload.token);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel pairing"
          >
            <Text className="text-muted-foreground text-sm">Cancel</Text>
          </Pressable>
          <Text className="text-foreground text-base font-semibold">Pair device</Text>
          <View style={{ width: 60 }} />
        </View>

        <View className="px-6 gap-4">
          <Text className="text-muted-foreground text-sm leading-snug">
            On your desktop, open Voicebox → Settings → Mobile → Pair device, then point your camera at the QR code.
          </Text>

          <View className="gap-2">
            <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
              Device name
            </Text>
            <TextInput
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="iPhone"
              placeholderTextColor={colors.mutedForeground}
              className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
              autoCapitalize="words"
            />
          </View>
        </View>

        <View className="flex-1 mx-6 mt-4 rounded-2xl overflow-hidden bg-card border border-border items-center justify-center">
          {permission?.granted ? (
            <CameraView
              style={{ width: '100%', height: '100%' }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : handleBarcode}
            />
          ) : (
            <View className="items-center gap-4 px-8">
              <Text className="text-foreground text-base text-center">
                Camera access lets you scan the pairing QR.
              </Text>
              <Button
                label={permission ? 'Allow camera' : 'Allow camera'}
                onPress={() => {
                  void requestPermission();
                }}
              />
            </View>
          )}
        </View>

        <View className="px-6 pt-4 pb-2 gap-3 border-t border-border mt-4">
          <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
            Or paste pairing URL
          </Text>
          <TextInput
            value={manualUrl}
            onChangeText={setManualUrl}
            placeholder="voicebox://pair?host=…&token=…"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
            style={{ minHeight: 60, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
          />
          {error ? (
            <Text className="text-destructive text-sm">{error}</Text>
          ) : null}
          <Button
            label={busy ? 'Pairing…' : 'Pair'}
            onPress={handleManualPair}
            loading={busy}
            disabled={!manualUrl.trim() || busy}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

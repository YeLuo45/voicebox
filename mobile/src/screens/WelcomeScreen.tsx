import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';

type Props = {
  onGetStarted: () => void;
};

export function WelcomeScreen({ onGetStarted }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-8 items-center justify-between py-12">
        <View className="flex-1 items-center justify-center gap-8">
          <View
            className="items-center justify-center"
            style={{
              shadowColor: '#AC8C39',
              shadowOpacity: 0.45,
              shadowRadius: 40,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 120, height: 120, borderRadius: 28 }}
            />
          </View>

          <View className="items-center gap-3">
            <Text className="text-foreground text-4xl font-bold tracking-tight text-center">
              Welcome to Voicebox
            </Text>
            <Text className="text-muted-foreground text-base text-center max-w-[280px] leading-snug">
              The open-source AI voice studio, in your pocket.
              Clone voices, dictate anywhere, and talk to agents in voices you own.
            </Text>
          </View>
        </View>

        <View className="w-full items-center gap-4">
          <Button label="Get started" size="lg" onPress={onGetStarted} />
          <Text className="text-muted-foreground text-xs text-center">
            You'll pair with your Voicebox desktop in the next step.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

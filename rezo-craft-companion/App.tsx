import { StatusBar } from 'expo-status-bar'
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { config } from './src/config'

const colors = {
  background: '#0B1210',
  card: '#12211C',
  cardBorder: '#1E3A31',
  primary: '#2ED87E',
  onPrimary: '#04150F',
  text: '#F1FBF6',
  muted: '#8AA79B',
}

function openLink(url: string) {
  if (!url) return
  void Linking.openURL(url).catch(() => undefined)
}

type ActionCardProps = {
  glyph: string
  title: string
  subtitle: string
  url: string
  primary?: boolean
  style?: StyleProp<ViewStyle>
}

function ActionCard({ glyph, title, subtitle, url, primary, style }: ActionCardProps) {
  const disabled = !url
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => openLink(url)}
      style={({ pressed }) => [
        styles.card,
        primary && styles.cardPrimary,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
        style,
      ]}
    >
      <View style={[styles.glyph, primary && styles.glyphPrimary]}>
        <Text style={[styles.glyphText, primary && styles.glyphTextPrimary]}>{glyph}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, primary && styles.cardTitlePrimary]}>{title}</Text>
        <Text style={[styles.cardSubtitle, primary && styles.cardSubtitlePrimary]}>
          {disabled ? 'Lien à venir' : subtitle}
        </Text>
      </View>
      <Text style={[styles.chevron, primary && styles.cardTitlePrimary]}>{disabled ? '•' : '›'}</Text>
    </Pressable>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image
              source={require('./assets/icon.png')}
              style={styles.logo}
              accessibilityIgnoresInvertColors
              accessible
              accessibilityLabel="Logo REZO-craft"
            />
            <Text style={styles.title}>{config.appName}</Text>
            <Text style={styles.tagline}>{config.tagline}</Text>
          </View>

          <Text style={styles.sectionTitle}>Communauté</Text>
          <ActionCard
            glyph="💬"
            title="Rejoindre le Discord"
            subtitle="Support, annonces et aide"
            url={config.discordUrl}
            primary
          />

          <Text style={styles.sectionTitle}>Le launcher</Text>
          <ActionCard
            glyph="⬇️"
            title="Télécharger REZO-craft"
            subtitle="Windows · version portable"
            url={config.downloadUrl}
          />
          <ActionCard
            glyph="🌐"
            title="Site web"
            subtitle="Actualités et téléchargements"
            url={config.websiteUrl}
            style={styles.cardSpacing}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Créé par {config.authors}</Text>
            <Text style={styles.footerMuted}>Version {config.version}</Text>
            <Text style={styles.footerLegal}>
              REZO-craft n'est ni un produit officiel Minecraft, ni approuvé par Mojang ou Microsoft.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 104,
    height: 104,
    borderRadius: 26,
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cardSpacing: {
    marginBottom: 0,
  },
  cardPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46,216,126,0.14)',
    marginRight: 14,
  },
  glyphPrimary: {
    backgroundColor: 'rgba(4,21,15,0.16)',
  },
  glyphText: {
    fontSize: 18,
  },
  glyphTextPrimary: {
    fontSize: 18,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardTitlePrimary: {
    color: colors.onPrimary,
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  cardSubtitlePrimary: {
    color: 'rgba(4,21,15,0.68)',
  },
  chevron: {
    color: colors.muted,
    fontSize: 20,
    marginLeft: 8,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  footerMuted: {
    color: colors.muted,
    fontSize: 12,
  },
  footerLegal: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
    opacity: 0.8,
  },
})

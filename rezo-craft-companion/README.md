# REZO-craft — app compagnon iOS

Application mobile (Expo / React Native) qui accompagne le launcher **REZO-craft** :
Discord de support, téléchargement du launcher, liens utiles, crédits.

> ⚠️ Ce n'est **pas** un launcher Minecraft. iOS interdit d'exécuter une JVM et du
> code téléchargé, donc Minecraft Java ne peut pas être lancé depuis une app
> installée via TestFlight. Cette app sert de hub/compagnon.

## Contenu

- `App.tsx` — écran unique : hero (logo + nom), Communauté, Le launcher, crédits
- `src/config.ts` — **tous les liens** (Discord, téléchargement, site web)
- `app.json` — identité, `bundleIdentifier` iOS, splash, icône
- `eas.json` — profils de build et de soumission

## Personnaliser les liens

Ouvre `src/config.ts` :

```ts
discordUrl: 'https://discord.gg/5CZXbjMcyv', // déjà rempli
downloadUrl: '',  // ← mets ici l'URL de téléchargement du launcher
websiteUrl: '',   // ← optionnel
```

Un champ laissé vide masque le bouton correspondant (`Lien à venir`).

## Prérequis pour TestFlight

1. Un **compte Expo** (gratuit) — https://expo.dev/signup
2. Un **Apple Developer Program** actif (99 $/an) — https://developer.apple.com/programs/
3. Un iPhone avec l'app **TestFlight** installée
4. Une app créée sur https://appstoreconnect.apple.com (section « Mes apps »)

L'identifiant iOS est `com.rezocraft.companion` (`app.json → expo.ios.bundleIdentifier`).
S'il est déjà pris, change-le (ex. `com.tonnom.rezocraft`).

## Build + envoi sur TestFlight

```bash
pnpm install                       # dépendances
npx eas login                      # connexion à ton compte Expo
npx eas init                       # crée le projet EAS, ajoute extra.eas.projectId
npx eas build -p ios --profile production
npx eas submit -p ios --profile production --latest
```

- `eas build` compile **dans le cloud** (aucun Mac nécessaire) et te demande tes
  identifiants Apple pour créer le certificat de distribution et le provisioning.
- `eas submit` envoie le build sur App Store Connect → il apparaît dans
  **TestFlight** après quelques minutes de traitement.
- Dans App Store Connect → TestFlight → **Groupes de testeurs**, crée un groupe
  interne ou externe et invite les personnes.

Après le premier envoi, mets à jour `version` dans `app.json` (ex. `1.0.1`) :
le numéro de build est incrémenté automatiquement (`autoIncrement: true`).

## Vérifications locales

```bash
npx tsc --noEmit            # types
npx expo config --type public  # config résolue
npx expo export -p ios --output-dir dist-ios   # bundle JS iOS
npx expo start              # test sur un iPhone avec Expo Go
```

## Notes App Store

- `ITSAppUsesNonExemptEncryption: false` est déjà déclaré : pas de question
  « export compliance » à chaque build.
- L'app ne collecte aucune donnée et n'ouvre que des liens externes, ce qui
  simplifie la fiche « Confidentialité ».
- La review peut demander un compte de démo : ici il n'y a pas de connexion,
  ce point ne devrait pas poser problème.

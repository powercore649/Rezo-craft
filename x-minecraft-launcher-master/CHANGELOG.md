# NovaCraft — Journal des versions

## 1.7.3 — NovaCraft Fichiers dans le Centre de logiciels

- Le Centre de logiciels (fenêtre intégrée au lanceur et application autonome)
  liste **NovaCraft Fichiers** à côté des cinq applications de la Suite.
- Fichiers s’installe depuis sa propre release files-v1.0.0 et se lance dans sa
  fenêtre dédiée ; la Suite reste installable et lançable indépendamment.
- Le canal de mise à jour du lanceur ne change pas : la release du lanceur reste
  celle que lisent les mises à jour automatiques.

## NovaCraft Software Center 1.7.0

- Le Centre autonome propose la même carte **NovaCraft Fichiers** : installation
  depuis files-v1.0.0 et lancement de l’application.

## 1.7.2 — Correctif de démarrage (preload)

- Electron 45 ne fournit plus les modules Node `events`, `timers` et `url` aux preloads
  sandboxés. Les preloads importaient `events`, ce qui les empêchait de se charger :
  l’interface restait vide et l’application semblait ne pas démarrer.
- `EventEmitter` est désormais embarqué dans le bundle des preloads, ce qui restaure
  `serviceChannels`, `taskMonitor` et `rendererTelemetry`.

## 1.7.1 — Chromium 156

- Moteur Electron mis à jour de 43.8.1 à 45.3.0 : Chromium passe de 150.0.7871.250
  à 156.0.8078.96, Node.js de 24.22.0 à 24.22.2 et V8 à 15.6.
- Aucun changement d’interface : correctifs de sécurité et de rendu du navigateur
  embarqué, fonctionnalités inchangées.

## 1.7.0 — Gestionnaire de comptes avancé

- Page Comptes repensée : statistiques (comptes, profils, sessions à renouveler),
  recherche, filtres par service et par session expirée, tri par nom, service ou
  nombre de profils.
- Panneau de détail par compte : skin, identifiant de connexion, UUID copiable,
  état et date d’expiration de la session, liste des profils de jeu.
- Actions : utiliser le compte, actualiser la session, reconnecter un compte
  expiré, retirer un profil hors ligne, supprimer le compte ; actualisation
  groupée de tous les comptes Microsoft et tiers avec bilan.
- Entrée « Gérer les comptes » dans le menu de compte de la barre latérale.

## 1.6.0 — NovaCraft Suite et Centre de logiciels

- Nouvelle **NovaCraft Suite** : Word (texte, export PDF), Sheets (formules, CSV),
  Slides (plein écran, PDF), PDF (lecteur dédié) et Notes (autosave, recherche).
  Chaque app s’ouvre séparément via `NovaCraft Suite.exe --app=<id>`.
- Le Centre de logiciels liste les produits NovaCraft Suite, détecte la suite
  installée, télécharge son installeur depuis la dernière release et lance le
  produit choisi. Le catalogue Modrinth n’y figure plus.
## 1.5.0 — Software Center en application séparée

- Nouvelle app autonome NovaCraft Software Center : exécutable et installateur dédiés,
  fenêtre, icône et entrée Démarrer propres ; catalogue Modrinth et remise de
  l'installation au lanceur.
- Le lanceur démarre l'app installée depuis le menu (Centre de logiciels) et
  retombe sur la fenêtre intégrée si elle est absente.
- Nouveau paramètre `--store modrinth/<projet>` pour ouvrir une fiche directement.

## 1.4.0 — Centre de logiciels, mise à jour et démarrage

- Nouvelle app « NovaCraft Software Center » : fenêtre dédiée, catalogue Modrinth
  (modpacks, mods, packs de ressources, shaders) et remise de l'installation au
  lanceur ; entrée « Centre de logiciels » dans le menu.
- Mise à jour : une seule fenêtre visible, le lanceur est masqué pendant
  l'opération ; une relance réactive la fenêtre existante au lieu d'en ouvrir une
  seconde ; installation automatique protégée contre un double déclenchement.
- Démarrage : écran de démarrage affiché dès que Electron est prêt.

## 1.3.0 — identité NovaCraft et section Développeur

- Nouvelle section Réglages → Développeur : versions (NovaCraft, Electron, Chromium, Node),
  plateforme, locale, chemins de données et de logs ; DevTools, ouverture des dossiers,
  rechargement de l'interface, copie des informations et lien vers les versions publiées.
- Suppression des noms XMCL / « X Minecraft Launcher » dans toutes les locales du
  renderer et du processus principal, l'écran de connexion et la description du serveur.
- Liens de versions redirigés vers le dépôt NovaCraft.
- Renommage d'identifiants internes : nom du paquet, types X11, cache de mise à jour.

## 1.2.1 — Discord Rich Presence

- Client RPC créé paresseusement : la présence se connecte bien au démarrage quand l'option est active.
- Reconnexion automatique toutes les 15 s tant que l'option est activée (Discord fermé ou redémarré).
- Statut « Dans NovaCraft » publié dès la connexion, avec temps écoulé.
- Suppression de l'asset `dark_512` invalide qui faisait rejeter la mise à jour d'activité.
- Lecture des trames IPC par tampon : les paquets partiels ou multiples ne cassent plus le socket.
- Pendant une partie : « En jeu / Minecraft », puis retour au statut du lanceur à la fermeture.

## 1.2.0 — page Protection et menu personnalisable

- Page `/protection` autonome : état de Microsoft Defender (temps réel, signatures,
  moteur, protection contre les falsifications, dates d'analyse).
- Analyse rapide et analyse des dossiers `mods` des instances, avec progression
  dossier par dossier, temps écoulé, bilan et liste des menaces détectées.
- Le moteur reste Microsoft Defender : NovaCraft ne le remplace pas et ne le désactive pas.
- Menu hamburger personnalisable (bouton flottant) : masquer/réordonner les entrées
  Accueil, Boutique, Serveurs, Actualités, Notes, Protection, Réglages ; choix persistés.

## 1.1.0 — mises à jour Windows

- Nouvelle page Réglages → Mises à jour Windows : liste des mises à jour en attente
  (titre, KB, gravité, taille), nombre, taille totale et date de la dernière recherche.
- Recherche via l'API Windows Update (`Microsoft.Update.Session`), lancée au démarrage
  et relançable à la demande.
- Installation depuis le lanceur : téléchargement puis application de toutes les mises
  à jour en attente, avec les phases affichées en direct.
- Bilan d'installation (succès, partiel, échec), alerte de redémarrage nécessaire,
  indication si le lanceur n'est pas élevé, et accès direct à Windows Update.
- Windows uniquement ; l'installation nécessite les droits administrateur.

## 1.0.1 — mises à jour visibles et redémarrage instantané

- Fenêtre de mise à jour dédiée qui s'ouvre d'elle-même quand une version est détectée :
  pourcentage, octets, débit, temps restant, versions, étapes Téléchargement → Installation → Redémarrage.
- Installation automatique à la fin du téléchargement : la fenêtre se ferme, l'installateur
  s'exécute sans assistant, puis NovaCraft redémarre.
- Écran de démarrage NovaCraft affiché immédiatement au relancement, jusqu'à ce que la
  fenêtre principale soit prête.
- Les actions de mise à jour des réglages passent par cette fenêtre au lieu de fermer
  directement l'application.

## 1.0.0 — lancement officiel

Première version stable de NovaCraft. Le launcher passe sur un canal **stable** :
les mises à jour automatiques ne proposent plus que des versions stables.

### Nouveautés
- **Écran de bienvenue** au premier lancement : présentation des fonctionnalités maison.
- **Diagnostic copiable** (Réglages → Outils) : version, système, processeur, mémoire, GPU,
  batterie, nombre de notes et documents, dossier de données, horodatage. Un clic copie tout
  pour le support.
- **Fenêtre d'updater autonome** (Réglages → À propos) : versions installée et nouvelle,
  progression de téléchargement, nouveautés, installation sans assistant puis redémarrage.

### Inclus depuis 0.78
- **Batterie** : niveau, état, autonomie, santé, cycles ; icône de batterie dessinée par le
  lanceur dans la zone de notification ; alerte sous 20 %.
- **Widgets de bureau** : statistiques PC et horloge, visibles launcher fermé.
- **Notes et documents** : édition intégrée, export/import JSON, jauge de stockage.
- **Mises à jour** : téléchargement automatique, installation à la fermeture, limite des
  connexions API Mojang.

### Correctifs importants
- Mise à jour qui ne s'installait pas (signature/publisher) — corrigé en 0.77.
- Installateur NSIS toujours nécessaire pour la première installation ; les mises à jour
  suivantes s'appliquent en silence.

### Limites connues
- Exécutables non signés : Windows affiche un avertissement SmartScreen au premier lancement.
- Sur certains pilotes, la santé et la capacité d'origine de la batterie ne sont pas exposées
  (affichage « — »).

# NovaCraft Fichiers

Gestionnaire de fichiers autonome pour Windows, inspiré de l’Explorateur Windows 11.
Il possède son propre exécutable et son installeur : ni la Suite ni le lanceur ne sont
nécessaires pour l’utiliser.

## Fonctionnalités

- Onglet de dossier, navigation précédent / suivant / parent / actualiser, fil d’Ariane
  cliquable et recherche dans le dossier courant.
- Nouveau dossier, nouveau document texte, couper, copier, coller, renommer, supprimer
  (vers la corbeille système), tri et panneau Détails.
- Liste de détails groupée par date, colonnes Nom / Modifié le / Type / Taille, sélection
  multiple ; accès rapide, dossiers épinglés, lecteurs, Corbeille et Réseau.
- Raccourcis F5, Retour arrière, F2, Suppr, Ctrl+A/C/X/V et Ctrl+L.

## Développement

```sh
# lancer l’application
npx electron@45.3.0 .

# construire l’installeur et le portable (sortie : ../build-output/files)
npx electron-builder@26.15.3 --config builder.config.cjs
```

## Téléchargement

Voir la release [`files-v1.0.0`](https://github.com/powercore649/Rezo-craft/releases/tag/files-v1.0.0) :
`NovaCraft-Files-Setup-1.0.0.exe`, `novacraft-files-1.0.0.exe` et `SHA256SUMS.txt`.

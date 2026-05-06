# Navigation Redesign — Sidebar

**Date:** 2026-05-06  
**Status:** Approved

## Objectif

Restructurer la sidebar pour séparer clairement les trois responsabilités actuellement mélangées : gestion du projet, navigation entre panels, et outils occasionnels. Ajouter un modal Paramètres pour centraliser les réglages (langue, et futurs settings).

## Structure finale de la sidebar

La sidebar reste une barre verticale de 44px. Elle est divisée en trois groupes séparés par des `sb-divider` :

### Groupe 1 — Projet (haut, juste après le logo)

| Icône | Comportement |
|-------|-------------|
| Nouveau projet | Inchangé — crée un nouveau projet (dialog si unsaved) |
| Ouvrir / Récents ▸ | Inchangé — dropdown existant avec projets récents + "Parcourir…" |
| Enregistrer ▸ | **Nouveau** — dropdown avec deux entrées : "Enregistrer" (Ctrl+S) et "Enregistrer sous…" (Ctrl+Shift+S) |

### Groupe 2 — Vues (milieu, séparé par un divider)

| Icône | Comportement |
|-------|-------------|
| Explorer | Toggle inchangé |
| Aperçu | Toggle inchangé |
| Recherche | Toggle inchangé |
| Diagnostics | Toggle inchangé |

Ce groupe est séparé du groupe Projet par un divider. Un spacer flex (`flex: 1`) est placé **entre le groupe Vues et le groupe Outils** pour pousser les outils en bas de la sidebar.

### Groupe 3 — Outils (bas, séparé par un divider)

| Icône | Comportement |
|-------|-------------|
| Historique | Inchangé — ouvre VersionsModal |
| Exporter ▸ | Inchangé — dropdown PDF/PNG/SVG existant, style accent bleu |
| Paramètres | **Nouveau** — ouvre SettingsModal (voir ci-dessous) |
| Aide | Inchangé — ouvre docs Typst |

## Supprimé

- **Bouton "Save As" standalone** → intégré dans le sous-menu du bouton Save
- **Toggle langue (EN/FR)** → déplacé dans SettingsModal

## Indicateur de sous-menu

Les boutons ayant un sous-menu (Ouvrir, Enregistrer, Exporter) affichent un petit point (3px, opacité 0.8) en bas à droite de l'icône. Couleur : `#89b4fa` sur les boutons normaux, `#11111b` sur le bouton Export (fond bleu accent).

## Modal Paramètres (SettingsModal)

Nouveau composant `src/components/Settings/SettingsModal.tsx`, cohérent avec `VersionsModal` existant (même pattern : modal centré, backdrop click-to-close).

**Contenu initial :**

- Section **Interface**
  - Langue : sélecteur FR / EN (remplace le toggle EN/FR de la sidebar)
  - Thème éditeur : sélecteur (One Dark, pour le futur)
  - Taille de police éditeur (pour le futur)
- Section **Compilation**
  - Debounce adaptatif : toggle (pour le futur)
  - Preview externe auto-open : toggle (pour le futur)

Seule la langue est fonctionnelle au premier passage. Les autres champs sont présents mais désactivés avec une mention "Bientôt disponible".

## Store

Ajouter dans `appStore.ts` :
- `settingsModalOpen: boolean`
- `openSettingsModal(): void`
- `closeSettingsModal(): void`

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/components/Sidebar.tsx` | Réorganisation groupes, sous-menu Save, suppression toggle langue, ajout bouton Paramètres |
| `src/store/appStore.ts` | Ajout `settingsModalOpen` + actions |
| `src/App.tsx` | Ajout `<SettingsModal>` conditionnel |
| `src/components/Settings/SettingsModal.tsx` | **Nouveau** composant |

## Ce qui ne change pas

- Largeur de la sidebar (44px)
- Logique des dropdowns Open/Recent et Export (code inchangé, juste repositionné)
- Comportement de tous les toggles de vues
- Comportement Save/SaveAs (logique inchangée, nouvelle surface d'accès)
- Thème Catppuccin Mocha

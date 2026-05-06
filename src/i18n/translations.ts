export const fr = {
  // Sidebar
  "sidebar.newProject": "Nouveau projet",
  "sidebar.openProject": "Ouvrir un projet",
  "sidebar.save": "Enregistrer (Ctrl+S)",
  "sidebar.explorer": "Explorateur",
  "sidebar.preview": "Aperçu",
  "sidebar.diagnostics": "Diagnostics",
  "sidebar.export": "Exporter",
  "sidebar.exportTitle": "Exporter",
  "sidebar.exportPdfDesc": "Document complet",
  "sidebar.exportPngDesc": "Images par page",
  "sidebar.exportSvgDesc": "Vectoriel par page",
  "sidebar.unsavedTitle": "Projet non sauvegardé",
  "sidebar.unsavedMessage":
    "Voulez-vous sauvegarder le projet actuel avant de continuer ?",
  "sidebar.unsavedHint": "Les modifications non sauvegardées seront perdues.",
  "sidebar.saveAs": "Enregistrer sous… (Ctrl+Shift+S)",
  "sidebar.cancel": "Annuler",
  "sidebar.dontSave": "Ne pas sauvegarder",
  "sidebar.saveBtn": "Sauvegarder",
  "sidebar.help": "Documentation Typst",
  "sidebar.quit": "Fermer l'application",
  "sidebar.search": "Rechercher dans les fichiers (Ctrl+Shift+F)",
  "sidebar.history": "Historique des versions",
  "sidebar.recentProjects": "Projets récents",
  "sidebar.settings": "Paramètres",
  "sidebar.saveMenu": "Enregistrer",
  "sidebar.saveAsFull": "Enregistrer sous…",
  // Settings modal
  "settings.title": "Paramètres",
  "settings.sectionInterface": "Interface",
  "settings.language": "Langue",
  "settings.langFr": "Français",
  "settings.langEn": "English",
  "settings.sectionCompilation": "Compilation",
  "settings.comingSoon": "Bientôt disponible",

  // Projets récents
  "recent.title": "Projets récents",
  "recent.empty": "Aucun projet récent",
  "recent.browse": "Parcourir…",
  "recent.remove": "Retirer de l'historique",

  // Explorateur
  "explorer.project": "Projet",
  "explorer.openFiles": "Fichiers ouverts",
  "explorer.newFile": "Nouveau fichier",
  "explorer.newFolder": "Nouveau dossier",
  "explorer.importFile": "Importer un fichier",
  "explorer.importFolder": "Importer un dossier",
  "explorer.rename": "Renommer",
  "explorer.delete": "Supprimer",
  "explorer.dropHere": "Déposer ici",
  "explorer.dropHint": "Fichiers et dossiers",
  "explorer.newFileTitle": "Nouveau fichier",
  "explorer.newFileLabel": "Nom du fichier",
  "explorer.newFolderTitle": "Nouveau dossier",
  "explorer.newFolderLabel": "Nom du dossier",
  "explorer.renameTitle": "Renommer",
  "explorer.renameLabel": "Nouveau nom",
  "explorer.deleteTitle": "Supprimer",
  "explorer.deleteConfirm":
    'Supprimer "{{name}}" ? Cette action est irréversible.',

  // Onglets éditeur
  "tabs.save": "Enregistrer",
  "tabs.close": "Fermer",
  "tabs.closeOthers": "Fermer les autres",
  "tabs.closeAll": "Fermer tous",

  // Éditeur
  "editor.openFileHint": "Ouvrir un fichier depuis l'explorateur",

  // Aperçu
  "preview.noProject": "Aucun projet ouvert",
  "preview.noProjectHint": "Créez ou ouvrez un projet depuis la barre latérale",
  "preview.page": "Page {{n}}",
  "preview.compiling": "Compilation...",
  "preview.compiled": "Compilé",
  "preview.popout": "Ouvrir dans une fenêtre",

  // Diagnostics
  "diagnostics.problems": "Problèmes",
  "diagnostics.output": "Sortie",
  "diagnostics.noProblems": "Aucun problème détecté",
  "diagnostics.unknown": "inconnu",
  "diagnostics.location": "ligne {{line}}, col {{col}}",
  "diagnostics.noOutput": "Aucune sortie",

  // Dialogues communs
  "dialog.cancel": "Annuler",
  "dialog.confirm": "Confirmer",
  "dialog.delete": "Supprimer",

  // Recherche multi-fichiers
  "search.placeholder": "Rechercher dans les fichiers...",
  "search.loading": "Recherche en cours...",
  "search.noResults": 'Aucun résultat pour "{{query}}"',
  "search.results": "{{count}} résultat(s) dans {{files}} fichier(s)",

  // Historique des versions
  "history.title": "Historique",
  "history.noVersions": "Aucune version sauvegardée",
  "history.create": "Créer une version",
  "history.restore": "Restaurer",
  "history.restoreConfirm": "Restaurer cette version ?",
  "history.noProject": "Aucun projet ouvert",
  "history.loading": "Chargement...",
  "history.autoSaveNote": "Une version est créée automatiquement à chaque sauvegarde.",

  // Sortie de compilation
  "output.compileStart": "► Compilation démarrée (gen {{gen}})",
  "output.compileReceived": "← Réponse reçue en {{ms}}ms",
  "output.compileIgnored": "↩ Ignoré — gen {{gen}} dépassé par {{latest}}",
  "output.compileSuccess":
    "✓ {{pages}} pages, {{updates}} màj, {{errors}} erreurs",
  "output.compileDeltaApplied": "✓ Delta appliqué",
  "output.compileCancelledGen": "↩ Annulée (gen {{gen}})",
  "output.compileCancelled": "↩ Annulée",
  "output.compileError": "✗ Erreur : {{error}}",
} as const;

export type TranslationKey = keyof typeof fr;

export const en: Record<TranslationKey, string> = {
  // Sidebar
  "sidebar.newProject": "New project",
  "sidebar.openProject": "Open project",
  "sidebar.save": "Save (Ctrl+S)",
  "sidebar.explorer": "Explorer",
  "sidebar.preview": "Preview",
  "sidebar.diagnostics": "Diagnostics",
  "sidebar.export": "Export",
  "sidebar.exportTitle": "Export",
  "sidebar.exportPdfDesc": "Full document",
  "sidebar.exportPngDesc": "Images per page",
  "sidebar.exportSvgDesc": "Vector per page",
  "sidebar.unsavedTitle": "Unsaved project",
  "sidebar.unsavedMessage":
    "Do you want to save the current project before continuing?",
  "sidebar.unsavedHint": "Unsaved changes will be lost.",
  "sidebar.saveAs": "Save As… (Ctrl+Shift+S)",
  "sidebar.cancel": "Cancel",
  "sidebar.dontSave": "Don't save",
  "sidebar.saveBtn": "Save",
  "sidebar.help": "Typst documentation",
  "sidebar.quit": "Quit",
  "sidebar.search": "Search in files (Ctrl+Shift+F)",
  "sidebar.history": "Version history",
  "sidebar.recentProjects": "Recent projects",
  "sidebar.settings": "Settings",
  "sidebar.saveMenu": "Save",
  "sidebar.saveAsFull": "Save As…",
  // Settings modal
  "settings.title": "Settings",
  "settings.sectionInterface": "Interface",
  "settings.language": "Language",
  "settings.langFr": "Français",
  "settings.langEn": "English",
  "settings.sectionCompilation": "Compilation",
  "settings.comingSoon": "Coming soon",

  // Recent projects
  "recent.title": "Recent projects",
  "recent.empty": "No recent projects",
  "recent.browse": "Browse…",
  "recent.remove": "Remove from history",

  // Explorer
  "explorer.project": "Project",
  "explorer.openFiles": "Open files",
  "explorer.newFile": "New file",
  "explorer.newFolder": "New folder",
  "explorer.importFile": "Import file",
  "explorer.importFolder": "Import folder",
  "explorer.rename": "Rename",
  "explorer.delete": "Delete",
  "explorer.dropHere": "Drop here",
  "explorer.dropHint": "Files and folders",
  "explorer.newFileTitle": "New file",
  "explorer.newFileLabel": "File name",
  "explorer.newFolderTitle": "New folder",
  "explorer.newFolderLabel": "Folder name",
  "explorer.renameTitle": "Rename",
  "explorer.renameLabel": "New name",
  "explorer.deleteTitle": "Delete",
  "explorer.deleteConfirm": 'Delete "{{name}}"? This action is irreversible.',

  // Editor tabs
  "tabs.save": "Save",
  "tabs.close": "Close",
  "tabs.closeOthers": "Close others",
  "tabs.closeAll": "Close all",

  // Editor
  "editor.openFileHint": "Open a file from the explorer",

  // Preview
  "preview.noProject": "No open project",
  "preview.noProjectHint": "Create or open a project from the sidebar",
  "preview.page": "Page {{n}}",
  "preview.compiling": "Compiling…",
  "preview.compiled": "Compiled",
  "preview.popout": "Open in window",

  // Diagnostics
  "diagnostics.problems": "Problems",
  "diagnostics.output": "Output",
  "diagnostics.noProblems": "No problems detected",
  "diagnostics.unknown": "unknown",
  "diagnostics.location": "line {{line}}, col {{col}}",
  "diagnostics.noOutput": "No output",

  // Common dialogs
  "dialog.cancel": "Cancel",
  "dialog.confirm": "Confirm",
  "dialog.delete": "Delete",

  // Multi-file search
  "search.placeholder": "Search in files...",
  "search.loading": "Searching...",
  "search.noResults": 'No results for "{{query}}"',
  "search.results": "{{count}} result(s) in {{files}} file(s)",

  // Version history
  "history.title": "History",
  "history.noVersions": "No saved versions",
  "history.create": "Create a version",
  "history.restore": "Restore",
  "history.restoreConfirm": "Restore this version?",
  "history.noProject": "No open project",
  "history.loading": "Loading...",
  "history.autoSaveNote": "A version is created automatically on each save.",

  // Compilation output
  "output.compileStart": "► Compile started (gen {{gen}})",
  "output.compileReceived": "← Response received in {{ms}}ms",
  "output.compileIgnored": "↩ Ignored — gen {{gen}} superseded by {{latest}}",
  "output.compileSuccess":
    "✓ {{pages}} pages, {{updates}} updates, {{errors}} errors",
  "output.compileDeltaApplied": "✓ Delta applied",
  "output.compileCancelledGen": "↩ Cancelled (gen {{gen}})",
  "output.compileCancelled": "↩ Cancelled",
  "output.compileError": "✗ Error: {{error}}",
};

import { useState, useRef, useEffect } from "react";
import {
  FaFolderPlus,
  FaFolderOpen,
  FaFileExport,
  FaFilePdf,
  FaFileImage,
  FaVectorSquare,
  FaTerminal,
  FaTableColumns,
  FaEye,
  FaFloppyDisk,
  FaArrowsDownToLine,
  FaMagnifyingGlass,
  FaXmark,
  FaCircleQuestion,
  FaClockRotateLeft,
  FaGear,
} from 'react-icons/fa6'
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppStore } from "../store/appStore";
import {
  newProject,
  openProject,
  exportProject,
  readFile,
  saveProject,
  writeFile,
  cleanupTmp,
  createVersion,
} from "../tauri/commands";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Dialog } from "./ui/Dialog";
import { useTranslation } from "../i18n/useTranslation";

type PendingSwitch = "none" | "newProject" | "openProject" | "openRecent";

export function Sidebar() {
  const [exportOpen, setExportOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>("none");
  const [pendingRecentPath, setPendingRecentPath] = useState<string | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    tmpPath,
    entryFile,
    toggleDiagnostics,
    setProject,
    diagnosticsVisible,
    openFile,
    toggleExplorer,
    explorerVisible,
    togglePreview,
    previewVisible,
    typzPath,
    setTypzPath,
    openFiles,
    activeFile,
    markFileSaved,
    recentProjects,
    addRecentProject,
    removeRecentProject,
    toggleSearch,
    searchVisible,
    openVersionsModal,
    openSettingsModal,
  } = useAppStore();
  const { t } = useTranslation();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
        setRecentOpen(false);
        setSaveOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── New / open with guard ──────────────────────────────────

  async function handleNewProject() {
    if (tmpPath) {
      setPendingSwitch("newProject");
      return;
    }
    await doNewProject();
  }

  async function handleOpenProject() {
    if (tmpPath) {
      setPendingSwitch("openProject");
      return;
    }
    await doOpenProject();
  }

  function handleOpenFromRecent(path: string) {
    setRecentOpen(false);
    if (tmpPath) {
      setPendingRecentPath(path);
      setPendingSwitch("openRecent");
      return;
    }
    doOpenWithPath(path);
  }

  // ── Actual project actions ────────────────────────────────

  async function doNewProject() {
    const name = `projet-${Date.now()}`;
    const info = await newProject(name);
    setProject(info.tmpPath, null, "main.typ", info.tree);
    const content = await readFile(info.tmpPath, "main.typ");
    openFile({ path: "main.typ", content, isDirty: false });
  }

  async function doOpenProject() {
    const selected = await open({
      filters: [{ name: "Typst Project", extensions: ["typz"] }],
    });
    if (!selected) return;
    const info = await openProject(selected as string);
    setProject(info.tmpPath, selected as string, "main.typ", info.tree);
    addRecentProject(selected as string);
    const content = await readFile(info.tmpPath, "main.typ").catch(() => "");
    if (content !== null) openFile({ path: "main.typ", content, isDirty: false });
  }

  async function doOpenWithPath(path: string) {
    try {
      const info = await openProject(path);
      setProject(info.tmpPath, path, "main.typ", info.tree);
      addRecentProject(path);
      const content = await readFile(info.tmpPath, "main.typ").catch(() => "");
      if (content !== null)
        openFile({ path: "main.typ", content, isDirty: false });
    } catch {
      removeRecentProject(path);
    }
  }

  async function doSwitch(which: PendingSwitch) {
    setPendingSwitch("none");
    if (which === "newProject") await doNewProject();
    else if (which === "openProject") await doOpenProject();
    else if (which === "openRecent" && pendingRecentPath) {
      const path = pendingRecentPath;
      setPendingRecentPath(null);
      await doOpenWithPath(path);
    }
  }

  // ── Save-before-switch handlers ───────────────────────────

  async function handleSaveAndSwitch() {
    if (!tmpPath) return;
    const oldTmp = tmpPath;
    const which = pendingSwitch;

    if (typzPath) {
      const file = openFiles.find((f) => f.path === activeFile);
      if (file) {
        await writeFile(oldTmp, file.path, file.content);
        markFileSaved(file.path);
      }
      await saveProject(oldTmp, typzPath);
    } else {
      const outPath = await save({
        filters: [{ name: "Typst Project", extensions: ["typz"] }],
      });
      if (!outPath) return;
      setTypzPath(outPath as string);
      addRecentProject(outPath as string);
      await saveProject(oldTmp, outPath as string);
    }

    await cleanupTmp(oldTmp);
    await doSwitch(which);
  }

  async function handleDiscardAndSwitch() {
    if (!tmpPath) return;
    const oldTmp = tmpPath;
    const which = pendingSwitch;
    await cleanupTmp(oldTmp);
    await doSwitch(which);
  }

  // ── Export / Save ─────────────────────────────────────────

  async function handleExport(format: "pdf" | "png" | "svg") {
    if (!tmpPath) return;
    setExportOpen(false);
    const stem = typzPath
      ? typzPath.replace(/\\/g, "/").split("/").pop()!.replace(/\.typz$/i, "")
      : entryFile.replace(/\.typ$/i, "");
    const defaultPath = `${stem}.${format}`;
    const outPath = await save({
      defaultPath,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!outPath) return;
    await exportProject(tmpPath, entryFile, format, outPath as string);
  }

  async function handleSave() {
    if (!tmpPath) return;
    if (typzPath) {
      const file = openFiles.find((f) => f.path === activeFile);
      if (file) {
        await writeFile(tmpPath, file.path, file.content);
        markFileSaved(file.path);
      }
      await saveProject(tmpPath, typzPath);
      createVersion(tmpPath).catch(() => {});
    } else {
      await handleSaveAs();
    }
  }

  async function handleSaveAs() {
    if (!tmpPath) return;
    const outPath = await save({
      filters: [{ name: "Typst Project", extensions: ["typz"] }],
    });
    if (!outPath) return;
    setTypzPath(outPath as string);
    addRecentProject(outPath as string);
    await saveProject(tmpPath, outPath as string);
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="w-11 bg-[#181825] flex flex-col items-center py-3 gap-1 border-r border-[#313244] flex-shrink-0 relative z-20">
      {/* Logo */}
      <div className="w-7 h-7 bg-[#89b4fa] rounded-md flex items-center justify-center text-[#11111b] font-black text-sm mb-2">
        T
      </div>

      {/* ── Groupe 1 : Projet ── */}
      <div className="flex flex-col gap-1 items-center" ref={menuRef}>
        {/* Nouveau projet */}
        <button
          title={t('sidebar.newProject')}
          onClick={handleNewProject}
          className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
        >
          <FaFolderPlus size={15} />
        </button>

        {/* Ouvrir / Récents */}
        <div className="relative">
          <button
            title={t('sidebar.openProject')}
            onClick={() => { setSaveOpen(false); setRecentOpen((o) => !o) }}
            className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors relative"
          >
            <FaFolderOpen size={15} />
            <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[#89b4fa] opacity-70" />
          </button>

          {recentOpen && (
            <div className="absolute left-10 top-0 bg-[#313244] border border-[#45475a] rounded-lg w-72 shadow-xl z-50 flex flex-col max-h-[70vh]">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#585b70] border-b border-[#45475a]">
                {t('recent.title')}
              </div>
              <div className="flex-1 overflow-y-auto">
                {recentProjects.length === 0 ? (
                  <div className="px-3 py-3 text-[10px] text-[#585b70]">{t('recent.empty')}</div>
                ) : (
                  recentProjects.map((path) => {
                    const normalized = path.replace(/\\/g, '/')
                    const name = normalized.split('/').pop()?.replace(/\.typz$/i, '') ?? path
                    const dir = normalized.split('/').slice(0, -1).join('/')
                    return (
                      <div
                        key={path}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-[#45475a] transition-colors group cursor-pointer border-b border-[#45475a]/40"
                        onClick={() => handleOpenFromRecent(path)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[#cdd6f4] text-[11px] font-medium truncate">{name}</div>
                          <div className="text-[9px] text-[#585b70] truncate">{dir}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeRecentProject(path) }}
                          title={t('recent.remove')}
                          className="opacity-0 group-hover:opacity-100 text-[#585b70] hover:text-[#f38ba8] transition-all shrink-0"
                        >
                          <FaXmark size={10} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="border-t border-[#45475a] p-1.5">
                <button
                  onClick={() => { setRecentOpen(false); handleOpenProject() }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#45475a] rounded-md transition-colors"
                >
                  <FaFolderOpen size={10} />
                  {t('recent.browse')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enregistrer (sous-menu) */}
        <div className="relative">
          <button
            title={t('sidebar.saveMenu')}
            disabled={!tmpPath}
            onClick={() => { setRecentOpen(false); setSaveOpen((o) => !o) }}
            className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#585b70] relative"
          >
            <FaFloppyDisk size={14} />
            <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[#89b4fa] opacity-70" />
          </button>

          {saveOpen && (
            <div className="absolute left-10 top-0 bg-[#313244] border border-[#45475a] rounded-lg w-44 shadow-xl overflow-hidden z-50">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#585b70] border-b border-[#45475a]">
                {t('sidebar.saveMenu')}
              </div>
              <button
                onClick={() => { setSaveOpen(false); handleSave() }}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#45475a] transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-md bg-[#89b4fa20] text-[#89b4fa] flex items-center justify-center text-sm flex-shrink-0">
                  <FaFloppyDisk size={12} />
                </div>
                <div>
                  <div className="text-[#cdd6f4] font-semibold text-[11px]">{t('sidebar.saveMenu')}</div>
                  <div className="text-[#585b70] text-[9px]">Ctrl+S</div>
                </div>
              </button>
              <button
                onClick={() => { setSaveOpen(false); handleSaveAs() }}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#45475a] transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-md bg-[#fab38720] text-[#fab387] flex items-center justify-center text-sm flex-shrink-0">
                  <FaArrowsDownToLine size={12} />
                </div>
                <div>
                  <div className="text-[#cdd6f4] font-semibold text-[11px]">{t('sidebar.saveAsFull')}</div>
                  <div className="text-[#585b70] text-[9px]">Ctrl+Shift+S</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-[#313244] w-6 mx-auto my-1" />

      {/* ── Groupe 2 : Vues ── */}
      <div className="flex flex-col gap-1 items-center">
        <button
          title={t('sidebar.explorer')}
          onClick={toggleExplorer}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
            explorerVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
          }`}
        >
          <FaTableColumns size={13} />
        </button>
        <button
          title={t('sidebar.preview')}
          onClick={togglePreview}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
            previewVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
          }`}
        >
          <FaEye size={13} />
        </button>
        <button
          title={t('sidebar.search')}
          onClick={toggleSearch}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
            searchVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
          }`}
        >
          <FaMagnifyingGlass size={13} />
        </button>
        <button
          title={t('sidebar.diagnostics')}
          onClick={toggleDiagnostics}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
            diagnosticsVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
          }`}
        >
          <FaTerminal size={13} />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Groupe 3 : Outils ── */}
      <div className="flex flex-col gap-1 items-center">
        <button
          title={t('sidebar.history')}
          onClick={openVersionsModal}
          disabled={!tmpPath}
          className="w-8 h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]"
        >
          <FaClockRotateLeft size={13} />
        </button>

        {/* Export */}
        <div className="relative">
          <button
            title={t('sidebar.export')}
            disabled={!tmpPath}
            onClick={() => setExportOpen((o) => !o)}
            className="w-8 h-8 flex items-center justify-center bg-[#89b4fa] text-[#11111b] rounded-md hover:bg-[#74c7ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#89b4fa] relative"
          >
            <FaFileExport size={15} />
            <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[#11111b] opacity-50" />
          </button>

          {exportOpen && (
            <div className="absolute left-10 bottom-0 bg-[#313244] border border-[#45475a] rounded-lg w-44 shadow-xl overflow-hidden z-50">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#585b70] border-b border-[#45475a]">
                {t('sidebar.exportTitle')}
              </div>
              {[
                { format: 'pdf' as const, icon: <FaFilePdf />, label: 'PDF', desc: t('sidebar.exportPdfDesc'), color: 'text-[#f38ba8]', bg: 'bg-[#f38ba820]' },
                { format: 'png' as const, icon: <FaFileImage />, label: 'PNG', desc: t('sidebar.exportPngDesc'), color: 'text-[#a6e3a1]', bg: 'bg-[#a6e3a120]' },
                { format: 'svg' as const, icon: <FaVectorSquare />, label: 'SVG', desc: t('sidebar.exportSvgDesc'), color: 'text-[#89b4fa]', bg: 'bg-[#89b4fa20]' },
              ].map(({ format, icon, label, desc, color, bg }) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#45475a] transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-md ${bg} ${color} flex items-center justify-center text-sm flex-shrink-0`}>
                    {icon}
                  </div>
                  <div>
                    <div className="text-[#cdd6f4] font-semibold text-[11px]">{label}</div>
                    <div className="text-[#585b70] text-[9px]">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-[#313244] w-6 mx-auto my-1" />

        {/* Paramètres */}
        <button
          title={t('sidebar.settings')}
          onClick={openSettingsModal}
          className="w-8 h-8 flex items-center justify-center text-[#cba6f7] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
        >
          <FaGear size={13} />
        </button>

        {/* Aide */}
        <button
          title={t('sidebar.help')}
          onClick={() => openUrl('https://typst.app/docs/')}
          className="w-8 h-8 flex items-center justify-center text-[#45475a] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
        >
          <FaCircleQuestion size={13} />
        </button>
      </div>

      {/* Save-before-switch dialog */}
      {pendingSwitch !== 'none' && (
        <Dialog
          title={t('sidebar.unsavedTitle')}
          onClose={() => setPendingSwitch('none')}
          actions={
            <>
              <button
                onClick={() => setPendingSwitch('none')}
                className="px-3 py-1.5 text-xs text-[#a6adc8] hover:text-[#cdd6f4] rounded-md hover:bg-[#313244] transition-colors"
              >
                {t('sidebar.cancel')}
              </button>
              <button
                onClick={handleDiscardAndSwitch}
                className="px-3 py-1.5 text-xs text-[#f38ba8] hover:text-[#cdd6f4] rounded-md hover:bg-[#313244] transition-colors"
              >
                {t('sidebar.dontSave')}
              </button>
              <button
                onClick={handleSaveAndSwitch}
                className="px-3 py-1.5 text-xs bg-[#89b4fa] text-[#11111b] rounded-md hover:bg-[#74c7ec] transition-colors"
              >
                {t('sidebar.saveBtn')}
              </button>
            </>
          }
        >
          <p className="text-sm text-[#a6adc8]">
            {t('sidebar.unsavedMessage')}
            <br />
            <span className="text-xs text-[#585b70] mt-1 block">{t('sidebar.unsavedHint')}</span>
          </p>
        </Dialog>
      )}
    </div>
  )
}

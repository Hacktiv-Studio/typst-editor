import { listen, emitTo } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect } from "react";
import {
  FaMagnifyingGlassMinus,
  FaMagnifyingGlassPlus,
  FaTableCellsLarge,
} from "react-icons/fa6";
import { useTranslation } from "../../i18n/useTranslation";
import { useAppStore } from "../../store/appStore";
import { readPreviewCache } from "../../tauri/commands";
import { PagesViewer } from "./PagesViewer";
import { Thumbnails } from "./Thumbnails";

const INITIAL_TMP_PATH = new URLSearchParams(window.location.search).get(
  "tmpPath",
);

export function StandalonePreview() {
  const { pages, zoom, isCompiling, setZoom, toggleThumbnails, showThumbnails } =
    useAppStore();
  const { t } = useTranslation();

  useEffect(() => {
    const win = getCurrentWebviewWindow();

    const unlistenClose = win.onCloseRequested((event) => {
      event.preventDefault();
      win.hide().catch(() => {});
      emitTo("main", "preview-popup-hidden", {}).catch(() => {});
    });

    if (INITIAL_TMP_PATH) {
      useAppStore.setState({ tmpPath: INITIAL_TMP_PATH });
    }

    async function refresh() {
      const tp = useAppStore.getState().tmpPath;
      if (!tp) return;
      const cached = await readPreviewCache(tp);
      if (cached && cached.length > 0) {
        useAppStore.getState().setPages(cached);
      }
    }

    refresh();

    let unlistenPage: (() => void) | undefined;
    listen<number>("active-page-changed", (e) => {
      useAppStore.setState({ activePage: e.payload });
    }).then((fn) => { unlistenPage = fn; });

    let unlistenStart: (() => void) | undefined;
    listen<unknown>("compilation-started", () => {
      useAppStore.setState({ isCompiling: true });
    }).then((fn) => { unlistenStart = fn; });

    let unlistenCompile: (() => void) | undefined;
    listen<unknown>("compilation-complete", async () => {
      await refresh();
      useAppStore.setState({ isCompiling: false });
    }).then((fn) => { unlistenCompile = fn; });

    let unlistenTmpPath: (() => void) | undefined;
    listen<string>("update-popup-tmppath", (e) => {
      useAppStore.setState({ tmpPath: e.payload });
      refresh();
    }).then((fn) => {
      unlistenTmpPath = fn;
    });

    return () => {
      unlistenClose.then((fn) => fn?.());
      unlistenPage?.();
      unlistenStart?.();
      unlistenCompile?.();
      unlistenTmpPath?.();
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#11111b] text-[#cdd6f4]">
      <div className="h-[30px] bg-[#181825] border-b border-[#313244] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              isCompiling ? "bg-[#f9e2af] animate-pulse" : "bg-[#a6e3a1]"
            }`}
            title={
              isCompiling ? t("preview.compiling") : t("preview.compiled")
            }
          />
          <span className="text-[10px] text-[#585b70] truncate">
            {pages.length} page{pages.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
            className="w-6 h-6 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] rounded"
          >
            <FaMagnifyingGlassMinus size={11} />
          </button>
          <span className="text-[10px] text-[#a6adc8] w-9 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="w-6 h-6 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] rounded"
          >
            <FaMagnifyingGlassPlus size={11} />
          </button>
          <div className="w-px h-4 bg-[#313244] mx-1" />
          <button
            onClick={toggleThumbnails}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              showThumbnails
                ? "text-[#89b4fa]"
                : "text-[#585b70] hover:text-[#cdd6f4]"
            }`}
          >
            <FaTableCellsLarge size={11} />
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <PagesViewer />
        <Thumbnails />
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  FaArrowUpRightFromSquare,
  FaMagnifyingGlassMinus,
  FaMagnifyingGlassPlus,
  FaTableCellsLarge,
} from "react-icons/fa6";
import { useTranslation } from "../../i18n/useTranslation";
import { useAppStore } from "../../store/appStore";
import { PagesViewer } from "./PagesViewer";
import { Thumbnails } from "./Thumbnails";

export function PreviewPanel() {
  const {
    pages,
    zoom,
    showThumbnails,
    isCompiling,
    entryFile,
    tmpPath,
    previewVisible,
    setZoom,
    toggleThumbnails,
  } = useAppStore();
  const { t } = useTranslation();
  const popupRef = useRef<WebviewWindow | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("preview-popup-hidden", () => {
      useAppStore.setState({ previewVisible: true });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const handlePopout = useCallback(async () => {
    if (popupRef.current) {
      await emitTo("preview-popup", "update-popup-tmppath", tmpPath).catch(
        () => {},
      );
      await popupRef.current.show().catch(() => {});
      useAppStore.setState({ previewVisible: false });
      return;
    }
    const url = tmpPath
      ? `preview.html?tmpPath=${encodeURIComponent(tmpPath)}`
      : "preview.html";
    const popup = new WebviewWindow("preview-popup", {
      url,
      title: "Aperçu",
      width: 800,
      height: 1000,
    });
    popupRef.current = popup;
    useAppStore.setState({ previewVisible: false });
  }, [tmpPath]);

  if (!previewVisible) return null;

  return (
    <div className="h-full flex flex-col bg-[#11111b]">
      <div className="h-[30px] bg-[#181825] border-b border-[#313244] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isCompiling ? "bg-[#f9e2af] animate-pulse" : "bg-[#a6e3a1]"
            }`}
            title={
              isCompiling ? t("preview.compiling") : t("preview.compiled")
            }
          />
          <span className="text-[10px] text-[#585b70] truncate">
            {entryFile} — {pages.length} page{pages.length !== 1 ? "s" : ""}
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
          <button
            onClick={handlePopout}
            title={t("preview.popout")}
            className="w-6 h-6 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] rounded"
          >
            <FaArrowUpRightFromSquare size={10} />
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

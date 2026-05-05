import { memo } from "react";
import { useAppStore } from "../../store/appStore";
import { useBlobUrls } from "../../lib/useBlobUrls";

export const Thumbnails = memo(function Thumbnails() {
  const pages = useAppStore(s => s.pages);
  const activePage = useAppStore(s => s.activePage);
  const showThumbnails = useAppStore(s => s.showThumbnails);
  const setActivePage = useAppStore(s => s.setActivePage);
  const blobUrls = useBlobUrls(pages);

  return (
    <div
      className={`w-[88px] bg-[#181825] border-l border-[#313244] overflow-y-auto flex flex-col items-center gap-2.5 py-3 flex-shrink-0${
        !showThumbnails || pages.length === 0 ? " hidden" : ""
      }`}
    >
      {blobUrls.map((url, i) => (
        <button
          key={i}
          onClick={() => setActivePage(i)}
          className={`w-[64px] rounded overflow-hidden border-2 transition-all flex-shrink-0 ${
            i === activePage
              ? "border-[#89b4fa] shadow-lg shadow-[#89b4fa]/20"
              : "border-[#313244] hover:border-[#45475a]"
          }`}
        >
          <img
            src={url}
            alt={`Page ${i + 1}`}
            className="w-full h-auto block"
            draggable={false}
          />
          <div
            className={`text-center text-[9px] py-0.5 bg-[#181825] ${
              i === activePage ? "text-[#89b4fa]" : "text-[#585b70]"
            }`}
          >
            {i + 1}
          </div>
        </button>
      ))}
    </div>
  );
});

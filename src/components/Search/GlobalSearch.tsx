import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaChevronDown,
  FaChevronRight,
  FaFileLines,
  FaMagnifyingGlass,
  FaXmark,
} from "react-icons/fa6";
import { useAppStore } from "../../store/appStore";
import { readFile } from "../../tauri/commands";
import { useTranslation } from "../../i18n/useTranslation";
import type { ProjectEntry } from "../../types";

interface Match {
  line: number;
  col: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface FileResults {
  file: string;
  matches: Match[];
}

function flattenFiles(tree: ProjectEntry[]): string[] {
  const files: string[] = [];
  function walk(entries: ProjectEntry[]) {
    for (const e of entries) {
      if (!e.isDir) files.push(e.path);
      if (e.children) walk(e.children);
    }
  }
  walk(tree);
  return files;
}

function searchContent(content: string | null, query: string): Match[] {
  if (!content || !query.trim()) return [];
  const lower = content.toLowerCase();
  const lq = query.toLowerCase();
  const matches: Match[] = [];
  const lines = content.split("\n");
  let offset = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineLower = line.toLowerCase();
    let col = 0;
    while (true) {
      const idx = lineLower.indexOf(lq, col);
      if (idx === -1) break;
      matches.push({
        line: li,
        col: idx,
        text: line,
        matchStart: idx,
        matchEnd: idx + query.length,
      });
      col = idx + 1;
    }
    offset += line.length + 1;
  }
  void lower;
  void offset;
  return matches;
}

interface Props {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileResults[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const { projectTree, openFiles, tmpPath, openFile, setPendingJump } =
    useAppStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !tmpPath) {
        setResults([]);
        return;
      }
      setLoading(true);
      const files = flattenFiles(projectTree);
      const grouped: FileResults[] = [];
      for (const file of files) {
        const cached = openFiles.find((f) => f.path === file);
        const content =
          cached?.content ??
          (await readFile(tmpPath, file).catch(() => null));
        const matches = searchContent(content, q);
        if (matches.length > 0) grouped.push({ file, matches });
      }
      setResults(grouped);
      setLoading(false);
    },
    [projectTree, openFiles, tmpPath],
  );

  function handleQueryChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 200);
  }

  async function handleNavigate(file: string, match: Match) {
    const content =
      openFiles.find((f) => f.path === file)?.content ??
      (tmpPath ? await readFile(tmpPath, file).catch(() => "") : "");
    if (!content) return;
    const lines = content.split("\n");
    let byteOffset = 0;
    for (let i = 0; i < match.line && i < lines.length; i++) {
      byteOffset += new TextEncoder().encode(lines[i] + "\n").byteLength;
    }
    byteOffset += new TextEncoder().encode(
      lines[match.line]?.slice(0, match.col) ?? "",
    ).byteLength;

    if (!openFiles.find((f) => f.path === file) && tmpPath) {
      const fileContent = await readFile(tmpPath, file).catch(() => "");
      openFile({ path: file, content: fileContent, isDirty: false });
    }
    setPendingJump({ file, byteOffset });
    onClose();
  }

  const totalMatches = results.reduce((s, r) => s + r.matches.length, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/50 flex items-start justify-center pt-[8vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[600px] max-h-[70vh] bg-[#1e1e2e] border border-[#45475a] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#313244]">
          <FaMagnifyingGlass size={13} className="text-[#585b70] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent text-[#cdd6f4] text-sm outline-none placeholder:text-[#585b70]"
          />
          <button
            onClick={onClose}
            className="text-[#585b70] hover:text-[#cdd6f4] transition-colors"
          >
            <FaXmark size={14} />
          </button>
        </div>

        {/* Status */}
        {query.trim() && (
          <div className="px-4 py-1.5 text-[10px] text-[#585b70] border-b border-[#313244] shrink-0">
            {loading
              ? t("search.loading")
              : results.length === 0
                ? t("search.noResults", { query })
                : t("search.results", {
                    count: totalMatches,
                    files: results.length,
                  })}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {results.map(({ file, matches }) => {
            const isCollapsed = collapsed.has(file);
            const fileName = file.split("/").pop() ?? file;
            const fileDir = file.split("/").slice(0, -1).join("/");
            return (
              <div key={file}>
                <button
                  onClick={() =>
                    setCollapsed((s) => {
                      const n = new Set(s);
                      if (n.has(file)) n.delete(file);
                      else n.add(file);
                      return n;
                    })
                  }
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#252535] transition-colors text-left"
                >
                  {isCollapsed ? (
                    <FaChevronRight size={9} className="text-[#585b70]" />
                  ) : (
                    <FaChevronDown size={9} className="text-[#585b70]" />
                  )}
                  <FaFileLines size={11} className="text-[#89b4fa] shrink-0" />
                  <span className="text-[#cdd6f4] text-xs font-medium">
                    {fileName}
                  </span>
                  {fileDir && (
                    <span className="text-[#585b70] text-[10px] truncate">
                      {fileDir}
                    </span>
                  )}
                  <span className="ml-auto text-[9px] text-[#585b70] bg-[#313244] px-1.5 py-0.5 rounded-full">
                    {matches.length}
                  </span>
                </button>

                {!isCollapsed &&
                  matches.map((match, mi) => (
                    <button
                      key={mi}
                      onClick={() => handleNavigate(file, match)}
                      className="w-full flex items-start gap-2 px-3 py-1 hover:bg-[#252535] transition-colors text-left"
                    >
                      <span className="text-[9px] text-[#585b70] w-8 text-right shrink-0 mt-0.5">
                        {match.line + 1}
                      </span>
                      <span className="text-[11px] text-[#a6adc8] font-mono truncate">
                        {match.text.slice(0, match.matchStart)}
                        <mark className="bg-[#f9e2af30] text-[#f9e2af] not-italic">
                          {match.text.slice(match.matchStart, match.matchEnd)}
                        </mark>
                        {match.text.slice(match.matchEnd)}
                      </span>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

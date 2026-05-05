import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "../../i18n/useTranslation";
import { useAppStore } from "../../store/appStore";
import {
  compilePreview,
  gotoDefinition,
  readFile,
  readPreviewCache,
  writeFile,
  writePreviewCache,
} from "../../tauri/commands";
import {
  CodeMirrorEditor,
  type CodeMirrorEditorHandle,
} from "./CodeMirrorEditor";
import { EditorTabs } from "./EditorTabs";

const DEBOUNCE_NORMAL_MS = 700;
const DEBOUNCE_ERROR_MS = 300;

function resolveImportPath(fromFile: string, importPath: string): string {
  const fromDir = fromFile.split('/').slice(0, -1)
  const parts = importPath.replace(/^\.\//, '').split('/')
  const resolved = [...fromDir]
  for (const part of parts) {
    if (part === '..') resolved.pop()
    else if (part !== '.') resolved.push(part)
  }
  return resolved.join('/')
}

function ts() {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function EditorPanel() {
  const {
    activeFile,
    openFiles,
    tmpPath,
    entryFile,
    updateFileContent,
    markFileSaved,
    openFile,
    setPages,
    applyPagesDelta,
    setSourceMap,
    setCompiling,
    setCompileErrors,
    appendOutput,
    clearOutput,
    compileErrors,
    sourceMap,
    activePage,
    setActivePage,
    pendingJump,
    setPendingJump,
  } = useAppStore();
  const sourceMapRef = useRef<Record<string, (number | null)[]>>(sourceMap);
  const activePageRef = useRef(activePage);
  const activeFileRef = useRef(activeFile);
  const compileErrorsRef = useRef(compileErrors);
  useEffect(() => {
    sourceMapRef.current = sourceMap;
  }, [sourceMap]);
  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);
  useEffect(() => {
    compileErrorsRef.current = compileErrors;
  }, [compileErrors]);

  const { t } = useTranslation();
  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const pendingJumpRef = useRef<number | undefined>(undefined);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  const jumpedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!pendingJump) return;
    if (pendingJump.file !== activeFile) {
      readFile(tmpPath!, pendingJump.file)
        .then((content) => {
          pendingJumpRef.current = pendingJump.byteOffset;
          openFile({ path: pendingJump.file, content, isDirty: false });
        })
        .catch(() => {})
        .finally(() => setPendingJump(null));
      return;
    }
    jumpedAtRef.current = Date.now();
    editorRef.current?.jumpTo(pendingJump.byteOffset);
    setPendingJump(null);
  }, [pendingJump, activeFile]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compileGenRef = useRef(0);
  const activeContent =
    openFiles.find((f) => f.path === activeFile)?.content ?? "";

  const runCompile = useCallback(async () => {
    if (!tmpPath) return;
    const gen = ++compileGenRef.current;
    setCompiling(true);
    clearOutput();
    const t0 = Date.now();
    appendOutput(`[${ts()}] ${t("output.compileStart", { gen })}`);
    try {
      const result = await compilePreview(tmpPath, entryFile);
      const elapsed = Date.now() - t0;
      appendOutput(
        `[${ts()}] ${t("output.compileReceived", { ms: elapsed })}`,
      );
      if (gen !== compileGenRef.current) {
        appendOutput(
          `[${ts()}] ${t("output.compileIgnored", { gen, latest: compileGenRef.current })}`,
        );
        return;
      }
      appendOutput(
        `[${ts()}] ${t("output.compileSuccess", {
          pages: result.pageCount,
          updates: result.pageUpdates.length,
          errors: result.errors.length,
        })}`,
      );
      applyPagesDelta(result.pageCount, result.pageUpdates);
      setSourceMap(result.sourceMap);
      setCompileErrors(result.errors);

      const cf = activeFileRef.current;
      if (cf) {
        const fileErrors = result.errors.filter(
          (e) => !e.file || e.file === cf || e.file === "<unknown>",
        );
        editorRef.current?.applyErrors(fileErrors);
      }
      if (result.output) appendOutput(result.output);
      if (result.pageCount > 0) {
        writePreviewCache(tmpPath, useAppStore.getState().pages).catch(() => {});
      }
    } catch (err) {
      if (gen !== compileGenRef.current) {
        appendOutput(
          `[${ts()}] ${t("output.compileCancelledGen", { gen })}`,
        );
        return;
      }
      if (String(err).includes("cancelled")) {
        appendOutput(`[${ts()}] ${t("output.compileCancelled")}`);
        return;
      }
      appendOutput(
        `[${ts()}] ${t("output.compileError", { error: String(err) })}`,
      );
    } finally {
      if (gen === compileGenRef.current) setCompiling(false);
    }
  }, [tmpPath, entryFile]);

  useEffect(() => {
    scrollPositionsRef.current = {};
    if (!tmpPath) return;
    readPreviewCache(tmpPath).then((cached) => {
      if (cached && cached.length > 0) setPages(cached);
    });
    runCompile();
  }, [tmpPath]);

  function handleChange(content: string) {
    if (!activeFile) return;
    updateFileContent(activeFile, content);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = compileErrorsRef.current.length > 0 ? DEBOUNCE_ERROR_MS : DEBOUNCE_NORMAL_MS;
    debounceRef.current = setTimeout(async () => {
      if (!tmpPath) return;
      await writeFile(tmpPath, activeFile, content).catch(() => {});
      runCompile();
    }, delay);
  }

  function handleCursorLine(line: number) {
    if (Date.now() - jumpedAtRef.current < 1500) return;
    const fileMap = activeFile
      ? sourceMapRef.current[activeFile] ??
        sourceMapRef.current[entryFile]
      : undefined;
    if (!fileMap || fileMap.length === 0) return;
    let page = 0;
    for (let i = 0; i < fileMap.length; i++) {
      const v = fileMap[i];
      if (v !== null && v !== undefined && v <= line) page = i;
    }
    if (page !== activePageRef.current) setActivePage(page);
  }

  async function handleGotoDefinition(cursorByte: number) {
    if (!tmpPath || !activeFile) return;

    // Check if cursor is on a file path in #import or #include
    const content = openFiles.find(f => f.path === activeFile)?.content ?? ''
    const charPos = new TextDecoder().decode(new TextEncoder().encode(content).slice(0, cursorByte)).length
    const lineStart = content.lastIndexOf('\n', charPos - 1) + 1
    const lineEnd = content.indexOf('\n', charPos)
    const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    const m = line.match(/^#(?:import|include)\s+"([^"]*)"/)
    if (m) {
      const importPath = m[1]
      if (!importPath.startsWith('@')) {
        const resolved = resolveImportPath(activeFile, importPath)
        const fileContent = await readFile(tmpPath, resolved).catch(() => null)
        if (fileContent !== null) {
          openFile({ path: resolved, content: fileContent, isDirty: false })
          return
        }
      }
    }

    const result = await gotoDefinition(tmpPath, entryFile, activeFile, cursorByte).catch(() => null);
    if (!result) return;
    if (result.file != null && result.byteOffset != null) {
      setPendingJump({ file: result.file, byteOffset: result.byteOffset });
    }
  }

  async function handleSave() {
    if (!tmpPath || !activeFile) return;
    const file = openFiles.find((f) => f.path === activeFile);
    if (!file) return;
    await writeFile(tmpPath, activeFile, file.content);
    markFileSaved(activeFile);
  }

  if (!activeFile) {
    return (
      <div className="h-full bg-[#1e1e2e] flex flex-col">
        <EditorTabs />
        <div className="flex-1 flex items-center justify-center text-[#585b70] text-sm">
          {t("editor.openFileHint")}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#1e1e2e] flex flex-col">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        <CodeMirrorEditor
          key={activeFile}
          ref={editorRef}
          content={activeContent}
          onChange={handleChange}
          onCursorLine={handleCursorLine}
          onSave={handleSave}
          onGotoDefinition={handleGotoDefinition}
          initialOffset={pendingJumpRef.current}
          initialScrollTop={scrollPositionsRef.current[activeFile]}
          onScrollTop={(y) => {
            scrollPositionsRef.current[activeFile!] = y;
          }}
          onMounted={() => {
            pendingJumpRef.current = undefined;
            if (activeFile) {
              const errs = compileErrorsRef.current.filter(
                (e) =>
                  !e.file || e.file === activeFile || e.file === "<unknown>",
              );
              editorRef.current?.applyErrors(errs);
            }
          }}
          tmpPath={tmpPath}
          entryFile={entryFile}
          currentFile={activeFile}
        />
      </div>
    </div>
  );
}

import { forwardRef, useEffect, useImperativeHandle, useRef, useCallback } from "react";
import { Compartment, EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, hoverTooltip, keymap, lineNumbers, rectangularSelection, scrollPastEnd } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, HighlightStyle, syntaxHighlighting, defaultHighlightStyle, codeFolding, foldGutter, foldKeymap, foldService } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { setDiagnostics, lintGutter } from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import type { CompletionContext } from "@codemirror/autocomplete";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { typstLanguage } from "../../lib/typst-language";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import type { CompileError } from "../../types";
import { useAppStore } from "../../store/appStore";
import { getCompletions, getTooltip, listCachedPackages, listUniversePackages } from "../../tauri/commands";
import type { CachedPackage } from "../../tauri/commands";

// ---------------------------------------------------------------------------
// Ctrl-hover link decoration
// ---------------------------------------------------------------------------

const setCtrlLink = StateEffect.define<{ from: number; to: number } | null>();

const ctrlLinkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setCtrlLink)) {
        if (e.value) {
          return Decoration.set([
            Decoration.mark({ class: "cm-ctrl-link" }).range(
              e.value.from,
              e.value.to,
            ),
          ]);
        }
        return Decoration.none;
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Package completion helpers
// ---------------------------------------------------------------------------

function flattenProjectTree(tree: { path: string; isDir: boolean; children?: typeof tree }[]): string[] {
  const files: string[] = []
  function walk(entries: typeof tree) {
    for (const e of entries) {
      if (!e.isDir) files.push(e.path)
      if (e.children) walk(e.children)
    }
  }
  walk(tree)
  return files
}

function relativeImportPath(from: string, to: string): string {
  const fromParts = from.split('/').slice(0, -1)
  const toParts = to.split('/')
  let common = 0
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++
  }
  const ups = fromParts.length - common
  const rel = [...Array(ups).fill('..'), ...toParts.slice(common)].join('/')
  return rel.startsWith('.') ? rel : './' + rel
}

let pkgCachePromise: Promise<CachedPackage[]> | null = null
function fetchAllPackages(): Promise<CachedPackage[]> {
  if (pkgCachePromise) return pkgCachePromise
  pkgCachePromise = Promise.all([listCachedPackages(), listUniversePackages()]).then(
    ([cached, universe]) => {
      const seen = new Set(cached.map((p) => `@${p.namespace}/${p.name}`))
      return [...cached, ...universe.filter((p) => !seen.has(`@${p.namespace}/${p.name}`))]
    }
  )
  return pkgCachePromise
}

// ---------------------------------------------------------------------------

interface Props {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onCursorLine?: (line: number) => void;
  onGotoDefinition?: (cursorByte: number) => void;
  initialOffset?: number;
  initialScrollTop?: number;
  onScrollTop?: (y: number) => void;
  onMounted?: () => void;
  tmpPath?: string | null;
  entryFile?: string;
  currentFile?: string | null;
}

export interface CodeMirrorEditorHandle {
  jumpTo: (byteOffset: number) => void;
  applyErrors: (errors: CompileError[]) => void;
}

// ---------------------------------------------------------------------------
// Typst-aware fold service — folds from { or [ at line end to matching close
// ---------------------------------------------------------------------------

const typstFoldService = foldService.of((state, _lineStart, lineEnd) => {
  const line = state.doc.lineAt(lineEnd === 0 ? 0 : lineEnd - 1)
  const text = line.text.trimEnd()
  const last = text[text.length - 1]
  if (last !== '{' && last !== '[') return null
  const close = last === '{' ? '}' : ']'
  let depth = 0
  for (let pos = lineEnd; pos < state.doc.length; pos++) {
    const ch = state.doc.sliceString(pos, pos + 1)
    if (ch === last) depth++
    else if (ch === close) {
      if (depth === 0) {
        const cl = state.doc.lineAt(pos)
        return cl.from > lineEnd ? { from: lineEnd, to: cl.from - 1 } : null
      }
      depth--
    }
  }
  return null
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function byteOffsetToPos(
  doc: { toString(): string; length: number },
  byteOffset: number,
): number {
  const text = doc.toString();
  const bytes = new TextEncoder().encode(text);
  if (byteOffset >= bytes.length) return doc.length;
  return new TextDecoder().decode(bytes.slice(0, byteOffset)).length;
}

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;

// Catppuccin Mocha syntax highlight style
const typstHighlightStyle = HighlightStyle.define([
  // Comments — muted, italic
  { tag: tags.comment,           color: "#6c7086", fontStyle: "italic" },

  // Strings — green
  { tag: tags.string,            color: "#a6e3a1" },

  // Math (atom) — pink
  { tag: tags.atom,              color: "#f5c2e7" },

  // Numbers + units — peach
  { tag: tags.number,            color: "#fab387" },

  // Hash keywords (#set, #let, #if…) — mauve
  { tag: tags.keyword,           color: "#cba6f7", fontWeight: "500" },

  // Function calls (#text(, #image(…) — sky/cyan
  { tag: tags.standard(tags.name), color: "#89dceb" },

  // Raw / inline code — teal
  { tag: tags.monospace,         color: "#94e2d5" },

  // Bold — yellow, bold
  { tag: tags.strong,            color: "#f9e2af", fontWeight: "bold" },

  // Italic — lavender, italic
  { tag: tags.emphasis,          color: "#b4befe", fontStyle: "italic" },

  // H1 (header) — blue, bold, large
  { tag: tags.heading,           color: "#89b4fa", fontWeight: "bold", fontSize: "1.15em" },

  // H2 (def) — sapphire, bold
  { tag: tags.definition(tags.variableName), color: "#74c7ec", fontWeight: "bold", fontSize: "1.07em" },

  // H3+ (qualifier) — sky
  { tag: tags.modifier,          color: "#89dceb", fontWeight: "600" },

  // Operators, punctuation — subtext
  { tag: tags.operator,          color: "#a6adc8" },
  { tag: tags.punctuation,       color: "#9399b2" },

  // Fallback text
  { tag: tags.content,           color: "#cdd6f4" },
])

// Badge helper — colored square with a letter, VSCode-style
function badge(letter: string, bg: string, fg = "#fff"): Record<string, string> {
  return {
    content: `'${letter}'`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "15px",
    height: "15px",
    borderRadius: "3px",
    background: bg,
    color: fg,
    fontSize: "9px",
    fontWeight: "700",
    fontFamily: "sans-serif",
    lineHeight: "1",
  }
}

const completionTheme = EditorView.theme({
  ".cm-tooltip": {
    border: "1px solid #45475a",
    borderRadius: "8px",
    boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
    overflow: "hidden",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    background: "#1e1e2e",
    padding: "4px",
    minWidth: "260px",
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: "12px",
    maxHeight: "240px",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "3px 8px",
    borderRadius: "5px",
    color: "#cdd6f4",
    lineHeight: "1.6",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected='true']": {
    background: "#313244",
    color: "#cdd6f4",
  },
  ".cm-completionMatchedText": {
    textDecoration: "none",
    color: "#89b4fa",
    fontWeight: "700",
  },
  ".cm-completionDetail": {
    marginLeft: "auto",
    paddingLeft: "8px",
    fontSize: "10px",
    color: "#45475a",
    fontStyle: "normal",
    flexShrink: "0",
  },
  // Icon container — fixed width, no default ::after content
  ".cm-completionIcon": {
    flexShrink: "0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    padding: "0",
  },
  ".cm-completionIcon::after": { content: "''" },

  // Per-type badges — Catppuccin Mocha palette
  ".cm-completionIcon-function::after":  badge("f", "#8839ef"),       // mauve
  ".cm-completionIcon-method::after":    badge("m", "#fe640b"),       // peach
  ".cm-completionIcon-variable::after":  badge("v", "#04a5e5"),       // sky
  ".cm-completionIcon-constant::after":  badge("c", "#df8e1d"),       // yellow
  ".cm-completionIcon-keyword::after":   badge("k", "#1e66f5"),       // blue
  ".cm-completionIcon-type::after":      badge("T", "#179299"),       // teal
  ".cm-completionIcon-class::after":     badge("C", "#40a02b"),       // green
  ".cm-completionIcon-interface::after": badge("I", "#209fb5"),       // sapphire
  ".cm-completionIcon-enum::after":      badge("E", "#ea76cb"),       // pink
  ".cm-completionIcon-property::after":  badge("p", "#d20f39"),       // red
  ".cm-completionIcon-namespace::after": badge("N", "#e64553"),       // maroon
  ".cm-completionIcon-text::after":      badge("t", "#6c6f85", "#cdd6f4"),  // overlay0
  ".cm-completionIcon-file::after":      badge("~", "#585b70", "#cdd6f4"),  // muted
}, { dark: true })

function fontTheme(size: number) {
  return EditorView.theme({
    "&": { height: "100%", fontSize: `${size}px` },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    },
    ".cm-ctrl-link": { textDecoration: "underline", cursor: "pointer" },
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, Props>(
  function CodeMirrorEditor(
    {
      content,
      onChange,
      onSave,
      onCursorLine,
      onGotoDefinition,
      initialOffset,
      initialScrollTop,
      onScrollTop,
      onMounted,
      currentFile,
      tmpPath,
      entryFile,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const currentFileRef = useRef(currentFile);
    currentFileRef.current = currentFile;
    const tmpPathRef = useRef(tmpPath);
    tmpPathRef.current = tmpPath;
    const entryFileRef = useRef(entryFile);
    entryFileRef.current = entryFile;
    const projectTree = useAppStore((s) => s.projectTree);
    const fontSizeRef = useRef(DEFAULT_FONT_SIZE);
    const fontCompartment = useRef(new Compartment());
    const wrapCompartment = useRef(new Compartment());
    const wrapRef = useRef(false);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;
    const onCursorLineRef = useRef(onCursorLine);
    onCursorLineRef.current = onCursorLine;
    const onGotoDefRef = useRef(onGotoDefinition);
    onGotoDefRef.current = onGotoDefinition;
    const onMountedRef = useRef(onMounted);
    onMountedRef.current = onMounted;
    const onScrollTopRef = useRef(onScrollTop);
    onScrollTopRef.current = onScrollTop;

    useImperativeHandle(ref, () => ({
      jumpTo: (byteOffset: number) => {
        const view = viewRef.current;
        if (!view) return;
        const pos = byteOffsetToPos(view.state.doc, byteOffset);
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        });
      },
      applyErrors: (errors: CompileError[]) => {
        const view = viewRef.current;
        if (!view) return;
        const diagnostics: Diagnostic[] = errors.flatMap((e) => {
          try {
            const line = view.state.doc.line(Math.max(1, e.line + 1));
            const from = Math.min(
              line.from + Math.max(0, e.col),
              line.to,
            );
            return [
              {
                from,
                to: from,
                severity: e.severity,
                message: e.message,
              },
            ];
          } catch {
            return [];
          }
        });
        view.dispatch(setDiagnostics(view.state, diagnostics));
      },
    }));

    const importCompletionSource = useCallback(async (context: CompletionContext) => {
      const lineStart = context.state.doc.lineAt(context.pos).from
      const before = context.state.doc.sliceString(lineStart, context.pos)
      const m = before.match(/#(?:import|include)\s+"([^"]*)$/)
      if (!m) return null
      const partial = m[1]
      const from = context.pos - partial.length

      if (partial.startsWith('@')) {
        const packages = await fetchAllPackages()
        const options = packages
          .filter((p) => context.explicit || `@${p.namespace}/${p.name}`.startsWith(partial))
          .map((p) => ({
            label: `@${p.namespace}/${p.name}:${p.version}`,
            type: 'keyword' as const,
            detail: p.namespace,
          }))
        return options.length > 0 || context.explicit ? { from, options, validFor: /^[^"]*$/ } : null
      }

      const cf = currentFileRef.current ?? ''
      const files = flattenProjectTree(projectTree).filter((f) => f.endsWith('.typ') && f !== cf)
      const options = files
        .map((f) => ({ label: relativeImportPath(cf, f), type: 'file' as const }))
        .filter((o) => context.explicit || o.label.toLowerCase().includes(partial.toLowerCase()))
      return options.length > 0 || context.explicit ? { from, options, validFor: /^[^"]*$/ } : null
    }, [projectTree])

    useEffect(() => {
      if (!containerRef.current) return;

      const ctrlHeld = { current: false };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Control") ctrlHeld.current = true;
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.key !== "Control") return;
        ctrlHeld.current = false;
        viewRef.current?.dispatch({ effects: setCtrlLink.of(null) });
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      const extensions = [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        highlightSelectionMatches(),
        indentationMarkers(),
        bracketMatching(),
        closeBrackets(),
        drawSelection(),
        rectangularSelection(),
        search({ top: true }),
        lintGutter(),
        codeFolding(),
        foldGutter(),
        typstFoldService,
        scrollPastEnd(),
        history(),
        ctrlLinkField,
        keymap.of([
          indentWithTab,
          ...closeBracketsKeymap,
          ...searchKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          {
            key: "Mod-s",
            run: () => {
              onSaveRef.current();
              return true;
            },
          },
          {
            key: "Alt-z",
            run: (view) => {
              wrapRef.current = !wrapRef.current;
              view.dispatch({
                effects: wrapCompartment.current.reconfigure(
                  wrapRef.current ? EditorView.lineWrapping : [],
                ),
              });
              return true;
            },
          },
        ]),
        autocompletion({
          override: [
            // IDE-aware completions (explicit only — requires a full compilation)
            async (context) => {
              if (!context.explicit) return null
              const tmp = tmpPathRef.current
              const entry = entryFileRef.current
              const cf = currentFileRef.current
              if (!tmp || !entry || !cf) return null
              const text = context.state.doc.sliceString(0, context.pos)
              const cursorByte = new TextEncoder().encode(text).byteLength
              try {
                const result = await getCompletions(tmp, entry, cf, cursorByte, true)
                if (!result || result.items.length === 0) return null
                const from = byteOffsetToPos(context.state.doc, result.from)
                return {
                  from,
                  options: result.items.map((item) => ({
                    label: item.label,
                    type: item.kind,
                    apply: item.apply ?? undefined,
                    detail: item.detail ?? undefined,
                  })),
                }
              } catch {
                return null
              }
            },
            importCompletionSource,
          ],
          maxRenderedOptions: 20,
        }),
        hoverTooltip(async (view, pos) => {
          const tmp = tmpPathRef.current
          const entry = entryFileRef.current
          const cf = currentFileRef.current
          if (!tmp || !entry || !cf) return null
          const text = view.state.doc.sliceString(0, pos)
          const cursorByte = new TextEncoder().encode(text).byteLength
          try {
            const tip = await getTooltip(tmp, entry, cf, cursorByte)
            if (!tip) return null
            return {
              pos,
              create() {
                const dom = document.createElement('div')
                dom.style.cssText =
                  'padding:4px 8px;font-size:12px;font-family:monospace;max-width:400px;white-space:pre-wrap;'
                dom.textContent = tip
                return { dom }
              },
            }
          } catch {
            return null
          }
        }),
        oneDark,
        syntaxHighlighting(typstHighlightStyle),
        completionTheme,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        typstLanguage,
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            onChangeRef.current(update.state.doc.toString());
          if (
            (update.selectionSet || update.docChanged) &&
            onCursorLineRef.current
          ) {
            const line =
              update.state.doc.lineAt(update.state.selection.main.head)
                .number - 1;
            onCursorLineRef.current(line);
          }
        }),
        EditorView.domEventHandlers({
          mousemove(e, view) {
            if (!ctrlHeld.current || !onGotoDefRef.current) {
              const hasDeco =
                view.state.field(ctrlLinkField) !== Decoration.none;
              if (hasDeco) view.dispatch({ effects: setCtrlLink.of(null) });
              return;
            }
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos == null) {
              view.dispatch({ effects: setCtrlLink.of(null) });
              return;
            }
            const word = view.state.wordAt(pos);
            if (!word || word.empty) {
              view.dispatch({ effects: setCtrlLink.of(null) });
              return;
            }
            view.dispatch({
              effects: setCtrlLink.of({ from: word.from, to: word.to }),
            });
          },
          mouseleave(_, view) {
            view.dispatch({ effects: setCtrlLink.of(null) });
          },
          mousedown(e, view) {
            if (!e.ctrlKey || !onGotoDefRef.current) return false;
            view.dispatch({ effects: setCtrlLink.of(null) });
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos == null) return false;
            const text = view.state.doc.sliceString(0, pos);
            onGotoDefRef.current(new TextEncoder().encode(text).byteLength);
            return true;
          },
        }),
        fontCompartment.current.of(fontTheme(fontSizeRef.current)),
        wrapCompartment.current.of([]),
      ];

      const state = EditorState.create({ doc: content, extensions });
      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;

      onMountedRef.current?.();

      if (initialOffset != null && initialOffset > 0) {
        const pos = byteOffsetToPos(view.state.doc, initialOffset);
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        });
      } else if (initialScrollTop) {
        requestAnimationFrame(() => {
          if (viewRef.current)
            viewRef.current.scrollDOM.scrollTop = initialScrollTop;
        });
      }

      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        onScrollTopRef.current?.(view.scrollDOM.scrollTop);
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const handleWheel = (e: WheelEvent) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const next = Math.min(
          MAX_FONT_SIZE,
          Math.max(MIN_FONT_SIZE, fontSizeRef.current + delta),
        );
        if (next === fontSizeRef.current) return;
        fontSizeRef.current = next;
        viewRef.current?.dispatch({
          effects: fontCompartment.current.reconfigure(fontTheme(next)),
        });
      };
      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel);
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current !== content) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: content },
        });
      }
    }, [content]);

    return <div ref={containerRef} className="h-full overflow-hidden" />;
  },
);

// src/hooks/useCompilation.ts
import { useCallback, useEffect, useRef, startTransition } from 'react'
import { emit } from '@tauri-apps/api/event'
import { useAppStore } from '../store/appStore'
import { compilePreview, writePreviewCache } from '../tauri/commands'
import { useTranslation } from '../i18n/useTranslation'
import type { CompileError } from '../types'

const DEBOUNCE_NORMAL_MS = 700
const DEBOUNCE_ERROR_MS = 300

function ts() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function useCompilation(
  applyErrors: ((errors: CompileError[]) => void) | null
) {
  const {
    tmpPath, entryFile, activeFile,
    applyPagesDelta, setSourceMap, setCompiling,
    setCompileErrors, appendOutput, clearOutput,
    compileErrors, activePage, setActivePage, sourceMap,
    updateFileContent,
  } = useAppStore()

  const { t } = useTranslation()

  const sourceMapRef = useRef(sourceMap)
  const activePageRef = useRef(activePage)
  const activeFileRef = useRef(activeFile)
  const compileErrorsRef = useRef(compileErrors)
  const jumpedAtRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const compileGenRef = useRef(0)

  useEffect(() => { sourceMapRef.current = sourceMap }, [sourceMap])
  useEffect(() => { activePageRef.current = activePage }, [activePage])
  useEffect(() => { activeFileRef.current = activeFile }, [activeFile])
  useEffect(() => { compileErrorsRef.current = compileErrors }, [compileErrors])

  const runCompile = useCallback(async (liveFile?: string | null, liveContent?: string | null) => {
    if (!tmpPath) return
    const gen = ++compileGenRef.current
    setCompiling(true)
    clearOutput()
    emit('compilation-started', {}).catch(() => {})
    const t0 = Date.now()
    appendOutput(`[${ts()}] ${t('output.compileStart', { gen })}`)
    try {
      const result = await compilePreview(tmpPath, entryFile, liveFile, liveContent)
      const elapsed = Date.now() - t0
      if (gen !== compileGenRef.current) {
        appendOutput(`[${ts()}] ${t('output.compileIgnored', { gen, latest: compileGenRef.current })}`)
        return
      }
      const cf = activeFileRef.current
      const fileErrors = cf
        ? result.errors.filter(e => !e.file || e.file === cf || e.file === '<unknown>')
        : []
      setCompileErrors(result.errors)
      applyErrors?.(fileErrors)
      startTransition(() => {
        appendOutput(`[${ts()}] ${t('output.compileReceived', { ms: elapsed })}`)
        appendOutput(`[${ts()}] ${t('output.compileSuccess', { pages: result.pageCount, updates: result.pageUpdates.length, errors: result.errors.length })}`)
        applyPagesDelta(result.pageCount, result.pageUpdates, result.errors.length > 0)
        setSourceMap(result.sourceMap)
        if (result.output) appendOutput(result.output)
        if (result.pageCount > 0) {
          writePreviewCache(tmpPath, useAppStore.getState().pages)
            .then(() => emit('compilation-complete', {}))
            .catch(() => {})
        }
      })
    } catch (err) {
      if (gen !== compileGenRef.current) {
        appendOutput(`[${ts()}] ${t('output.compileCancelledGen', { gen })}`)
        return
      }
      if (String(err).includes('cancelled')) {
        appendOutput(`[${ts()}] ${t('output.compileCancelled')}`)
        return
      }
      appendOutput(`[${ts()}] ${t('output.compileError', { error: String(err) })}`)
    } finally {
      if (gen === compileGenRef.current) setCompiling(false)
    }
  }, [tmpPath, entryFile])

  function handleChange(content: string) {
    const file = activeFileRef.current
    if (!file) return
    updateFileContent(file, content)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = compileErrorsRef.current.length > 0 ? DEBOUNCE_ERROR_MS : DEBOUNCE_NORMAL_MS
    debounceRef.current = setTimeout(() => {
      if (!tmpPath) return
      runCompile(file, content)
    }, delay)
  }

  function handleCursorLine(line: number) {
    if (Date.now() - jumpedAtRef.current < 1500) return
    const fileMap = activeFileRef.current
      ? sourceMapRef.current[activeFileRef.current] ?? sourceMapRef.current[entryFile]
      : undefined
    if (!fileMap || fileMap.length === 0) return
    let page = 0
    for (let i = 0; i < fileMap.length; i++) {
      const v = fileMap[i]
      if (v !== null && v !== undefined && v <= line) page = i
    }
    if (page !== activePageRef.current) setActivePage(page)
  }

  return { runCompile, handleChange, handleCursorLine, jumpedAtRef }
}

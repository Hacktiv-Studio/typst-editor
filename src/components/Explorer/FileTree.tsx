import { useState } from 'react'
import {
  FaChevronRight, FaChevronDown,
  FaFolder, FaFolderOpen, FaFileLines,
  FaFileCirclePlus, FaFolderPlus,
} from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import { readFile, createFile, createFolder, listProject } from '../../tauri/commands'
import type { ProjectEntry } from '../../types'

function TreeNode({ entry, depth = 0 }: { entry: ProjectEntry; depth?: number }) {
  const [open, setOpen] = useState(depth === 0)
  const { tmpPath, openFile } = useAppStore()

  async function handleFileClick() {
    if (!tmpPath) return
    const content = await readFile(tmpPath, entry.path)
    openFile({ path: entry.path, content, isDirty: false })
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-[#313244]/50 text-[#a6adc8] text-[10px] group"
        style={{ paddingLeft: `${16 + depth * 12}px` }}
        onClick={() => entry.isDir ? setOpen((o) => !o) : handleFileClick()}
      >
        {entry.isDir && (
          open
            ? <FaChevronDown size={8} className="text-[#585b70]" />
            : <FaChevronRight size={8} className="text-[#585b70]" />
        )}
        {!entry.isDir && <span className="w-2" />}
        {entry.isDir
          ? (open ? <FaFolderOpen size={11} className="text-[#f9e2af]" /> : <FaFolder size={11} className="text-[#f9e2af]" />)
          : <FaFileLines size={11} className="text-[#89b4fa]" />
        }
        <span className="truncate flex-1">{entry.name}</span>
      </div>
      {entry.isDir && open && entry.children?.map((child) => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function FileTree() {
  const { projectTree, tmpPath, setProjectTree } = useAppStore()

  async function handleNewFile() {
    if (!tmpPath) return
    const name = prompt('Nom du fichier :')
    if (!name) return
    await createFile(tmpPath, name)
    const tree = await listProject(tmpPath)
    setProjectTree(tree)
  }

  async function handleNewFolder() {
    if (!tmpPath) return
    const name = prompt('Nom du dossier :')
    if (!name) return
    await createFolder(tmpPath, name)
    const tree = await listProject(tmpPath)
    setProjectTree(tree)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#585b70] flex items-center justify-between">
        <span>Projet</span>
        <div className="flex gap-1.5">
          <button onClick={handleNewFile} title="Nouveau fichier" className="hover:text-[#cdd6f4]">
            <FaFileCirclePlus size={10} />
          </button>
          <button onClick={handleNewFolder} title="Nouveau dossier" className="hover:text-[#cdd6f4]">
            <FaFolderPlus size={10} />
          </button>
        </div>
      </div>
      {projectTree.map((entry) => (
        <TreeNode key={entry.path} entry={entry} />
      ))}
    </div>
  )
}

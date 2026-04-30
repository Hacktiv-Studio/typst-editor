import { OpenFilesList } from './OpenFilesList'
import { FileTree } from './FileTree'

export function Explorer() {
  return (
    <div className="h-full bg-[#1e1e2e] border-r border-[#313244] flex flex-col overflow-hidden">
      <div className="border-b border-[#313244]">
        <OpenFilesList />
      </div>
      <FileTree />
    </div>
  )
}

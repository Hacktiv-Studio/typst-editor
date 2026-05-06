import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Read current version from package.json
const pkgPath = resolve(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const next = `${major}.${minor}.${patch + 1}`

// package.json
pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// tauri.conf.json
const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json')
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'))
tauriConf.version = next
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n')

// Cargo.toml — simple regex replace on the first version line
const cargoPath = resolve(root, 'src-tauri/Cargo.toml')
const cargo = readFileSync(cargoPath, 'utf8')
const updatedCargo = cargo.replace(/^version = "[\d.]+"$/m, `version = "${next}"`)
writeFileSync(cargoPath, updatedCargo)

console.log(`version bumped to ${next}`)

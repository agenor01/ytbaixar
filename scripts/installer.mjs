// Gera release/ytbaixar-Setup-<versão>.exe
//
//   pnpm installer
//
// 1. compila a interface (web/dist)
// 2. compila o ytbaixar.exe (abridor/desinstalador) com o csc que vem no Windows
// 3. junta server.js + web/dist + node.exe + ícones num payload.zip
// 4. compila o Setup.exe com o payload.zip dentro
import { execFileSync, execSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const src = join(root, "app", "installer")
const build = join(root, "build", "installer")
const payload = join(build, "payload")
const release = join(root, "release")
const windir = process.env.SystemRoot || "C:\\Windows"
const csc = join(windir, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe")
const tar = join(windir, "System32", "tar.exe")
const ico = join(root, "app", "ytbaixar.ico")

const step = (msg) => console.log("\n▸ " + msg)
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", cwd: root, ...opts })

if (!existsSync(csc)) throw new Error("csc.exe não encontrado em " + csc)

step("Compilando a interface")
execSync("pnpm --dir web build", { stdio: "inherit", cwd: root })

step("Preparando a pasta do payload")
rmSync(build, { recursive: true, force: true })
mkdirSync(join(payload, "runtime"), { recursive: true })
mkdirSync(release, { recursive: true })
writeFileSync(join(build, "Version.cs"), `static class AppInfo { public const string Version = "${version}"; }\n`)

cpSync(join(root, "server.js"), join(payload, "server.js"))
cpSync(join(root, "README.md"), join(payload, "README.md"))
cpSync(join(root, "web", "dist"), join(payload, "web", "dist"), { recursive: true })
cpSync(ico, join(payload, "ytbaixar.ico"))
// O Node que está rodando este script vai junto: quem instala não precisa ter Node
cpSync(process.execPath, join(payload, "runtime", "node.exe"))

const refs = ["System.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.IO.Compression.dll", "System.IO.Compression.FileSystem.dll"]
  .map((r) => "/r:" + r)

step("Compilando ytbaixar.exe")
run(csc, ["/nologo", "/target:winexe", "/optimize+", `/win32icon:${ico}`, `/out:${join(payload, "ytbaixar.exe")}`, ...refs,
  join(src, "Launcher.cs"), join(src, "Common.cs")])

step("Compactando o payload")
const zip = join(build, "payload.zip")
run(tar, ["-a", "-c", "-f", zip, ...readdirSync(payload)], { cwd: payload })

step("Compilando o instalador")
const out = join(release, `ytbaixar-Setup-${version}.exe`)
run(csc, ["/nologo", "/target:winexe", "/optimize+", `/win32icon:${ico}`, `/out:${out}`, ...refs,
  `/resource:${zip},payload.zip`, `/resource:${join(root, "web", "public", "icons", "icon-192.png")},logo.png`,
  join(src, "Setup.cs"), join(src, "Common.cs"), join(build, "Version.cs")])

console.log(`\n✓ ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB)`)

@echo off
rem Modo navegador: abre http://localhost:8787 na aba normal. Pra janela de app, use app\ytbaixar.vbs.
cd /d "%~dp0"
if not exist web\dist\index.html (
  echo Compilando a interface pela primeira vez...
  call pnpm install || goto :eof
  call pnpm build || goto :eof
)
start "" http://localhost:8787
node server.js

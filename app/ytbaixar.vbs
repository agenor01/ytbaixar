' Abre o ytbaixar como app de PC: servidor escondido (sem janela preta) + janela própria do Edge/Chrome.
' O servidor desliga sozinho quando a janela é fechada.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root

' Primeira vez: compila a interface
If Not fso.FileExists(root & "\web\dist\index.html") Then
  sh.Run "cmd /c pnpm install && pnpm build", 1, True
End If

sh.Run "node """ & root & "\server.js"" --app", 0, False

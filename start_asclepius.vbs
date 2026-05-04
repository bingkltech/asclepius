Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "f:\012A_Github\asclepius"
WshShell.Run "cmd /c npm run daemon:start", 0, True
WshShell.Run "cmd /c npm run widget", 0, False

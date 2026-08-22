$wsh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path -Path $desktop -ChildPath "Astral Archive.lnk"
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "c:\Users\Chyle\OneDrive\Documents\Main\HSR Coding\launch_astral_archive.bat"
$shortcut.WorkingDirectory = "c:\Users\Chyle\OneDrive\Documents\Main\HSR Coding"
$shortcut.Description = "Launch Astral Archive Honkai: Star Rail Roster Tool"
$shortcut.IconLocation = "shell32.dll, 14"
$shortcut.Save()
Write-Host "Desktop shortcut created at: $shortcutPath"

@echo off
REM SkyWatch launcher for Windows
REM Opens the app in Chrome/Edge in chromeless "app" mode — no URL bar, no tabs,
REM no bookmarks. Looks like a real native window.

setlocal
set "APP_URL=file:///%~dp0index.html"
set "APP_URL=%APP_URL:\=/%"

REM Try Chrome first, then Edge, then Brave, then default browser
set "CHROME_PATHS=^
%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe;^
%PROGRAMFILES%\Google\Chrome\Application\chrome.exe;^
%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe;^
%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe;^
%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe;^
%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe;^
%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"

for %%P in ("%CHROME_PATHS:;=" "%") do (
  if exist %%P (
    echo Launching SkyWatch via %%P
    start "" %%P --app=%APP_URL% --user-data-dir="%LOCALAPPDATA%\SkyWatch\profile" --window-size=420,820 --disable-features=GlobalMediaControls,MediaRouter
    exit /b 0
  )
)

echo No Chrome/Edge/Brave found. Opening in default browser instead.
start "" "%APP_URL%"
endlocal

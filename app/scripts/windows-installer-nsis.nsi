Unicode true
Target x86-unicode
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "${MB_PAYLOAD_INCLUDE}"

!define MB_APP_ID "net.antoniofradique.multibrowser"
!ifndef MB_TEST
 !define MB_SETUP_KEY "Software\AntonioFradique\Multi-Browser\Setup"
 !define MB_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\AntonioFradique.Multi-Browser"
!else
 !define MB_SETUP_KEY "Software\AntonioFradique\Multi-Browser\InstallerTests\${MB_TEST_ID}"
 !define MB_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MultiBrowser-Test-${MB_TEST_ID}"
!endif

Name "Multi-Browser"
OutFile "${MB_OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Multi-Browser"
InstallDirRegKey HKCU "${MB_SETUP_KEY}" "InstallLocation"
RequestExecutionLevel user
CRCCheck force
SetCompressor /SOLID zlib
SetDatablockOptimize on
AllowSkipFiles off
ShowInstDetails show
ShowUninstDetails show
BrandingText "Antonio Fradique | AntonioFradique.net"
VIProductVersion "${MB_VERSION}.0"
VIAddVersionKey "ProductName" "Multi-Browser Setup"
VIAddVersionKey "CompanyName" "Antonio Fradique"
VIAddVersionKey "FileDescription" "Multi-Browser Electron application installer"
VIAddVersionKey "ProductVersion" "${MB_VERSION}"
VIAddVersionKey "FileVersion" "${MB_VERSION}"
VIAddVersionKey "LegalCopyright" "Antonio Fradique"

Var DesktopRoot
Var MenuRoot
!define MUI_ABORTWARNING
!define MUI_ICON "${MB_ICON}"
!define MUI_UNICON "${MB_ICON}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Multi-Browser.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Portuguese"

LangString Need64 ${LANG_ENGLISH} "Multi-Browser requires 64-bit Windows."
LangString Need64 ${LANG_PORTUGUESE} "O Multi-Browser necessita de Windows de 64 bits."
LangString CloseApplication ${LANG_ENGLISH} "Close Multi-Browser and its browser profiles before continuing."
LangString CloseApplication ${LANG_PORTUGUESE} "Fecha o Multi-Browser e os seus perfis antes de continuar."
LangString PreviousMSI ${LANG_ENGLISH} "An MSI installation was found. Remove it in Windows Settings > Apps before running this setup. Its data folder will be preserved."
LangString PreviousMSI ${LANG_PORTUGUESE} "Foi encontrada uma instalacao MSI. Remove-a em Definicoes do Windows > Aplicacoes antes de executar este instalador. A pasta data sera conservada."
LangString WrongFolder ${LANG_ENGLISH} "The installation marker does not match Multi-Browser. No files were removed."
LangString WrongFolder ${LANG_PORTUGUESE} "A pasta nao corresponde a uma instalacao do Multi-Browser. Nenhum ficheiro foi removido."
LangString LockedFiles ${LANG_ENGLISH} "Some application files are in use. Close all Multi-Browser windows and retry. Your data folder is preserved."
LangString LockedFiles ${LANG_PORTUGUESE} "Existem ficheiros da aplicacao em utilizacao. Fecha todas as janelas do Multi-Browser e tenta novamente. A pasta data sera conservada."

!macro CheckApplicationClosed PREFIX
 !ifndef MB_TEST
  ${PREFIX}check_running:
  FindWindow $0 "Chrome_WidgetWin_1" "Multi-Browser"
  StrCmp $0 0 ${PREFIX}closed
  IfSilent ${PREFIX}busy
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(CloseApplication)" IDRETRY ${PREFIX}check_running
  ${PREFIX}busy:
  SetErrorLevel 1618
  Abort
  ${PREFIX}closed:
 !endif
!macroend

Function .onInit
 SetShellVarContext current
 SetRegView 64
 ${IfNot} ${RunningX64}
  MessageBox MB_OK|MB_ICONSTOP "$(Need64)"
  SetErrorLevel 1633
  Abort
 ${EndIf}
 !ifndef MB_TEST
  ReadRegStr $0 HKCU "Software\AntonioFradique\Multi-Browser\Installer" "InstallDir"
  StrCmp $0 "" no_msi
  IfSilent msi_found
  MessageBox MB_OK|MB_ICONEXCLAMATION "$(PreviousMSI)"
  msi_found:
  SetErrorLevel 1638
  Abort
  no_msi:
 !endif
 !insertmacro CheckApplicationClosed "install_"
FunctionEnd

Function .onVerifyInstDir
 ${GetRoot} "$INSTDIR" $0
 StrCmp "$INSTDIR" "$0" invalid_directory
 StrCmp "$INSTDIR" "$0\" invalid_directory
 IfFileExists "$INSTDIR\Multi-Browser.install.ini" existing_installation
 ; A fresh destination may be empty or contain retained user data only.
 FindFirst $0 $1 "$INSTDIR\*"
 directory_loop:
 StrCmp $1 "" directory_valid
 StrCmp $1 "." directory_next
 StrCmp $1 ".." directory_next
 StrCmp $1 "data" directory_next
 FindClose $0
 Goto invalid_directory
 directory_next:
 FindNext $0 $1
 Goto directory_loop
 directory_valid:
 FindClose $0
 Return
 existing_installation:
 ReadINIStr $0 "$INSTDIR\Multi-Browser.install.ini" "Setup" "AppId"
 StrCmp $0 "${MB_APP_ID}" 0 invalid_directory
 Return
 invalid_directory:
 Abort
FunctionEnd

Section "Multi-Browser"
 SetShellVarContext current
 SetRegView 64
 SetOverwrite on
 !insertmacro MB_INSTALL_FILES
 SetOutPath "$INSTDIR"
 WriteINIStr "$INSTDIR\Multi-Browser.install.ini" "Setup" "AppId" "${MB_APP_ID}"
 WriteINIStr "$INSTDIR\Multi-Browser.install.ini" "Setup" "Version" "${MB_VERSION}"
 WriteUninstaller "$INSTDIR\Uninstall Multi-Browser.exe"
 !ifndef MB_TEST
  StrCpy $DesktopRoot "$DESKTOP"
  StrCpy $MenuRoot "$SMPROGRAMS\Multi-Browser"
 !else
  StrCpy $DesktopRoot "$INSTDIR\TestLinks\Desktop"
  StrCpy $MenuRoot "$INSTDIR\TestLinks\StartMenu"
 !endif
 CreateDirectory "$DesktopRoot"
 CreateDirectory "$MenuRoot"
 CreateShortcut "$DesktopRoot\Multi-Browser.lnk" "$INSTDIR\Multi-Browser.exe" "" "$INSTDIR\Multi-Browser.exe" 0
 CreateShortcut "$MenuRoot\Multi-Browser.lnk" "$INSTDIR\Multi-Browser.exe" "" "$INSTDIR\Multi-Browser.exe" 0
 WriteINIStr "$INSTDIR\Multi-Browser.install.ini" "Setup" "DesktopRoot" "$DesktopRoot"
 WriteINIStr "$INSTDIR\Multi-Browser.install.ini" "Setup" "MenuRoot" "$MenuRoot"
 WriteRegStr HKCU "${MB_SETUP_KEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "DisplayName" "Multi-Browser"
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "DisplayVersion" "${MB_VERSION}"
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "Publisher" "Antonio Fradique"
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\Multi-Browser.exe"
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall Multi-Browser.exe$\"'
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall Multi-Browser.exe$\" /S'
 WriteRegStr HKCU "${MB_UNINSTALL_KEY}" "URLInfoAbout" "https://AntonioFradique.net"
 WriteRegDWORD HKCU "${MB_UNINSTALL_KEY}" "EstimatedSize" ${MB_SIZE_KB}
 WriteRegDWORD HKCU "${MB_UNINSTALL_KEY}" "NoModify" 1
 WriteRegDWORD HKCU "${MB_UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Function un.onInit
 SetShellVarContext current
 SetRegView 64
 ReadINIStr $0 "$INSTDIR\Multi-Browser.install.ini" "Setup" "AppId"
 StrCmp $0 "${MB_APP_ID}" marker_valid
 IfSilent marker_invalid
 MessageBox MB_OK|MB_ICONSTOP "$(WrongFolder)"
 marker_invalid:
 SetErrorLevel 1
 Abort
 marker_valid:
 !insertmacro CheckApplicationClosed "uninstall_"
FunctionEnd

Section "Uninstall"
 SetShellVarContext current
 SetRegView 64
 uninstall_files:
 ClearErrors
 !insertmacro MB_REMOVE_FILES
 IfErrors 0 uninstall_files_removed
 IfSilent uninstall_failed
 MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(LockedFiles)" IDRETRY uninstall_files
 uninstall_failed:
 SetErrorLevel 1
 Abort
 uninstall_files_removed:
 ReadINIStr $DesktopRoot "$INSTDIR\Multi-Browser.install.ini" "Setup" "DesktopRoot"
 ReadINIStr $MenuRoot "$INSTDIR\Multi-Browser.install.ini" "Setup" "MenuRoot"
 Delete "$DesktopRoot\Multi-Browser.lnk"
 Delete "$MenuRoot\Multi-Browser.lnk"
 RMDir "$MenuRoot"
 !ifdef MB_TEST
  RMDir "$DesktopRoot"
  RMDir "$INSTDIR\TestLinks"
 !endif
 DeleteRegKey HKCU "${MB_UNINSTALL_KEY}"
 DeleteRegKey HKCU "${MB_SETUP_KEY}"
 Delete "$INSTDIR\Multi-Browser.install.ini"
 Delete "$INSTDIR\Uninstall Multi-Browser.exe"
 !insertmacro MB_REMOVE_EMPTY_DIRECTORIES
 SetOutPath "$TEMP"
 ; No recursive directory removal: data and other user files are retained.
 RMDir "$INSTDIR"
SectionEnd

; Branding NovaCraft de l'assistant d'installation (installateur assiste).
; Inclus via l'option nsis.include.

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bienvenue dans NovaCraft"
  !define MUI_WELCOMEPAGE_TEXT "Cet assistant va installer NovaCraft, le launcher Minecraft.$\r$\n$\r$\nChoisissez le dossier d'installation, puis lancez l'application a la fin de l'installation."
  !insertmacro MUI_PAGE_WELCOME
!macroend

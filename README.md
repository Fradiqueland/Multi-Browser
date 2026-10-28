# Multi-Browser

Browser profile manager for Windows and macOS, created by Antonio Fradique. Available as a Windows installer and portable packages.

## Features

- Separate browser profiles, cookies, local storage, IndexedDB and browsing sessions.
- Bundled full Chromium browser with extensions, plus an embedded browser engine.
- Proxy configuration, per-profile language, time zone, resolution and privacy controls.
- Multiple groups per profile; CSV/JSON configuration import and export.
- Encrypted session sharing, bookmarks, history, downloads and startup page restoration.
- Eleven interface languages, with English selected by default.
- Startup progress while validating/extracting the Windows runtime and opening the workspace.
- Nine accessible social links in the author menu, with local SVG icons and fixed HTTPS destinations.

This is an independent application. Complete equivalence with every Logii or Chromium feature is not claimed.

## Windows installer

The single `Multi-Browser-0.21.3-Windows-Setup.msi` installs the complete application, Electron and Chromium into `%LOCALAPPDATA%\Programs\Multi-Browser` by default. It creates Desktop and Start menu shortcuts and a normal Windows uninstall entry. The folder can be changed in the installer. No separate Node.js, Electron, Chrome or .NET installation is required by the end user.

Profiles and sessions remain in the installed folder's `data` directory. Updates use a Windows Installer rollback transaction; uninstall removes only installer-owned files and empty directories, preserving user data. Portable data is not imported automatically: close both copies before transferring the complete `data` folder to the installation directory.

The MSI structure, shortcut destinations, and all 388 embedded file hashes were verified. A live install/repair/uninstall test could not complete in the restricted build environment because the Windows Installer service was unavailable (error 1601). Native installation and application launch still require a normal Windows host check.

To build from the verified portable artifact, place it in `app/dist`, then run these development commands with Python 3 and .NET 6 or later:

```sh
python app/scripts/prepare-windows-installer.py
python app/scripts/build-windows-installer.py
python app/scripts/verify-windows-installer.py --verify-payload
```

The build tools are not installed or required on the end user's computer. The optional `--install-test` verifier creates a separate test product and redirects shortcuts into its isolated test directory.

## Portable releases

**Windows:** open the single portable EXE. It carries Electron and Chromium. No separate Node.js, Electron or Chrome installation is required. The first opening extracts a verified runtime cache; later openings validate and reuse it. Profile data remains in `data` beside the outer EXE.

**Mac:** select the complete `Mac-Portable` folder in **Software portable → Choose folder**, then select `Multi-Browser.app` as the Mac program. The universal outer launcher chooses the bundled Intel or Apple Silicon runtime. macOS 13 or later is required. Keep the complete app structure and relative symbolic links.

Extract the Mac ZIP on macOS with Archive Utility or `ditto -x -k archive.zip destination`. On Windows use `app/scripts/extract-macos-portable.ps1`; ordinary ZIP extractors may turn symbolic links into text files. The folder must be writable for portable persistence.

The Mac 0.21.2 archive was structurally verified and imported using the Builder's actual import/copy code on Windows. **Opening it on a real Mac has not been tested. The delivery is unsigned and not notarized.** Source changes also invalidate any original application-level runtime signatures; retained signature files do not establish a valid signature for the modified app.

Do not commit your `data` folder or share unencrypted profile exports containing private information. OS-protected credentials may not transfer between computers.

## Source and development

The `app` directory contains application sources, packaging tools and tests. End-user release runtimes are bundled in the delivery; development runtimes and generated packages are intentionally absent from Git.

Core tests require Node.js 24 or later:

```sh
cd app
npm test
```

On Windows, `app/scripts/start.ps1` prepares the pinned Electron runtime; `prepare-chromium.ps1` prepares full Chromium. `verify-desktop.ps1` exercises the real desktop app with isolated test data. Test and build scripts must be run from a local checkout with their required development tools available.

Packaging entry points:

- `build.ps1`: Windows folder distribution.
- `build-windows-single-file.py`: single Windows EXE, using prepared runtimes, Python/Pillow and the Go toolchain configured in the script.
- `prepare-macos.mjs`, `build-macos.py`, `build-macos-unified.py`, `build-macos-single.py`, `build-macos-portable.py`: Mac runtime preparation and successive bundle formats.
- `refresh-macos-artwork.py`: incremental update from a verified prior Mac portable package; it deliberately requires that base artifact.
- `verify-windows-single-file.py`, `verify-startup-progress.py`: execution, persistence, integrity and startup checks for the delivered EXE.

The 0.21.3 social menu was checked in bundled Chromium with a local IPC fixture across eleven languages, two themes and two layouts. Electron execution in the current AppContainer was blocked by Windows ACL constraints; a normal-host Electron rerun remains pending. The new Mac ZIP retains the same native runtime binaries and all 38 symbolic links.

Some packaging and compatibility tests use locally prepared toolchains, prior verified delivery archives, or the separately supplied Windows & Mac Software Builder. They are not self-contained fresh-checkout tests. Generated verification reports and development caches are excluded from this public backup.

## Optional REA tooling

The `rea` submodule pins the upstream [morluto/rea](https://github.com/morluto/rea) analysis tools. It is **not required to run Multi-Browser**. Initialize it only when needed:

```sh
git submodule update --init --recursive
```

Upstream nested submodule test fixtures can contain filenames unsupported by Windows. Use a filesystem supporting those names for a complete recursive checkout. No proprietary reference application or extracted reference files are included.

## License and credits

The application package currently declares `UNLICENSED`; this public repository does not grant an open-source license. Electron, Chromium, REA and other third-party components retain their respective licenses and notices. Runtime distributions must retain those notices.

Created by **Antonio Fradique** — [More products](https://AntonioFradique.net).

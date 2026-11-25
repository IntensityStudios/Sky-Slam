@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Sky Slam

set "PORT=8477"
set "TRIES=0"

:findport
set /a TRIES+=1
if !TRIES! GTR 30 goto portok
set "SKYSLAM_PORT=!PORT!"
powershell -NoProfile -EncodedCommand JABwACAAPQAgAFsAaQBuAHQAXQAkAGUAbgB2ADoAUwBLAFkAUwBMAEEATQBfAFAATwBSAFQACgB0AHIAeQAgAHsACgAgACAAJAB0ACAAPQAgAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABTAHkAcwB0AGUAbQAuAE4AZQB0AC4AUwBvAGMAawBlAHQAcwAuAFQAYwBwAEMAbABpAGUAbgB0AAoAIAAgACQAdAAuAEMAbwBuAG4AZQBjAHQAKAAiADEAMgA3AC4AMAAuADAALgAxACIALAAgACQAcAApAAoAIAAgACQAdAAuAEMAbABvAHMAZQAoACkACgAgACAAZQB4AGkAdAAgADAACgB9ACAAYwBhAHQAYwBoACAAewAKACAAIABlAHgAaQB0ACAAMQAKAH0ACgA= >nul 2>&1
if errorlevel 1 goto portok
set /a PORT+=1
goto findport

:portok
set "URL=http://127.0.0.1:!PORT!/"
echo.
echo   SKY SLAM
echo   Opening  !URL!
echo   Leave this window open while you play.
echo   Close this window when you are done.
echo.

set "SKYSLAM_PORT=!PORT!"
where powershell >nul 2>&1
if errorlevel 1 goto openplain
start "Sky Slam" powershell -NoProfile -WindowStyle Hidden -EncodedCommand JABwACAAPQAgACQAZQBuAHYAOgBTAEsAWQBTAEwAQQBNAF8AUABPAFIAVAAKACQAdQAgAD0AIAAiAGgAdAB0AHAAOgAvAC8AMQAyADcALgAwAC4AMAAuADEAOgAkAHAALwAiAAoAZgBvAHIAIAAoACQAaQAgAD0AIAAwADsAIAAkAGkAIAAtAGwAdAAgADEANgAwADsAIAAkAGkAKwArACkAIAB7AAoAIAAgAHQAcgB5ACAAewAKACAAIAAgACAAJABjACAAPQAgAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABTAHkAcwB0AGUAbQAuAE4AZQB0AC4AUwBvAGMAawBlAHQAcwAuAFQAYwBwAEMAbABpAGUAbgB0AAoAIAAgACAAIAAkAGMALgBDAG8AbgBuAGUAYwB0ACgAIgAxADIANwAuADAALgAwAC4AMQAiACwAIABbAGkAbgB0AF0AJABwACkACgAgACAAIAAgACQAYwAuAEMAbABvAHMAZQAoACkACgAgACAAIAAgAFMAdABhAHIAdAAtAFAAcgBvAGMAZQBzAHMAIAAkAHUACgAgACAAIAAgAGUAeABpAHQAIAAwAAoAIAAgAH0AIABjAGEAdABjAGgAIAB7AAoAIAAgACAAIABTAHQAYQByAHQALQBTAGwAZQBlAHAAIAAtAE0AaQBsAGwAaQBzAGUAYwBvAG4AZABzACAAMgA1ADAACgAgACAAfQAKAH0ACgBTAHQAYQByAHQALQBQAHIAbwBjAGUAcwBzACAAJAB1AAoA
goto serve

:openplain
echo   If the browser does not open, visit:
echo   !URL!
start "Sky Slam" cmd /c "ping -n 3 127.0.0.1 >nul & start !URL!"

:serve
where py >nul 2>&1
if errorlevel 1 goto trypython
echo   Trying: py -m http.server !PORT! --bind 127.0.0.1
py -m http.server !PORT! --bind 127.0.0.1
if not errorlevel 1 goto finished
echo   py exited. Trying the next option...
echo.

:trypython
where python >nul 2>&1
if errorlevel 1 goto trynpx
echo   Trying: python -m http.server !PORT! --bind 127.0.0.1
python -m http.server !PORT! --bind 127.0.0.1
if not errorlevel 1 goto finished
echo   python exited. Trying the next option...
echo.

:trynpx
where npx >nul 2>&1
if errorlevel 1 goto tryserve
echo   Trying: npx --yes serve -l !PORT!
call npx --yes serve -l !PORT!
if not errorlevel 1 goto finished
echo   npx exited.
echo.

:tryserve
where py >nul 2>&1
if errorlevel 1 goto tryservepy
echo   Trying: py serve.py !PORT!
py serve.py !PORT!
if not errorlevel 1 goto finished

:tryservepy
where python >nul 2>&1
if errorlevel 1 goto noprog
echo   Trying: python serve.py !PORT!
python serve.py !PORT!
if not errorlevel 1 goto finished

:noprog
echo.
echo   Sky Slam could not start a local server.
echo.
echo   Install Python, then double-click start.bat again.
echo   Download: https://www.python.org/downloads/
echo   On the first installer screen, check "Add python.exe to PATH".
echo.
echo   Node.js also works. Install it from https://nodejs.org/
echo   and double-click start.bat again.
echo.
echo   Already installed? Open Command Prompt in this folder and run:
echo     py -m http.server !PORT! --bind 127.0.0.1
echo   Then visit !URL!
echo.
pause
exit /b 1

:finished
echo.
echo   Server stopped. You can close this window.
exit /b 0

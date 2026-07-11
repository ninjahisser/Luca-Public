@echo off
setlocal
cd /d "%~dp0"
py -3 cms_server.py --port 8000
endlocal

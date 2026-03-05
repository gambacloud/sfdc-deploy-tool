@echo off
echo Installing required dependencies...
pip install pyinstaller uvicorn fastapi httpx pydantic

echo.
echo Building executable with PyInstaller...
echo This may take a minute or two...
pyinstaller --name "SalesforceDeployer" --add-data "static;static" --clean -y --onefile server.py

echo.
echo Build complete! You can find the executable in the 'dist' folder.
pause

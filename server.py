import uvicorn
from app import app
import multiprocessing

if __name__ == '__main__':
    # Needed for PyInstaller on Windows if using multiprocessing under the hood
    multiprocessing.freeze_support()
    
    # Run Uvicorn programmatically
    uvicorn.run(app, host="127.0.0.1", port=8000)

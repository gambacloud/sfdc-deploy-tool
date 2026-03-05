import uvicorn
from app import app
import multiprocessing
import traceback
import webbrowser
import threading
import time

import socket

def get_free_port(start_port=8000):
    port = start_port
    while port < 9000:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
        port += 1
    return start_port

def open_browser(port):
    time.sleep(1.5)
    print(f"\nOpening http://127.0.0.1:{port} in your browser...")
    webbrowser.open(f"http://127.0.0.1:{port}")

if __name__ == '__main__':
    # Needed for PyInstaller on Windows if using multiprocessing under the hood
    multiprocessing.freeze_support()
    
    # Find dynamically available port
    port = get_free_port()
    
    # Run Uvicorn programmatically
    try:
        print("Starting Salesforce Deployment Tool...")
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()
        uvicorn.run(app, host="127.0.0.1", port=port)
    except Exception as e:
        print("\nAn error occurred while starting the application:")
        traceback.print_exc()
    except KeyboardInterrupt:
        print("\nShutting down...")
    
    print("\nPress ENTER to exit...")
    input()


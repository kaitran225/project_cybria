#!/usr/bin/env python3
"""
Cybria Web Interface Setup Script
Automates the setup process for the web interface
"""

import os
import sys
import subprocess
import socket
import time

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"📋 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            return True
        else:
            print(f"❌ {description} failed:")
            print(f"   Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ {description} failed with exception: {e}")
        return False

def check_ollama():
    """Check if Ollama is running"""
    try:
        import requests
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        return response.status_code == 200
    except:
        return False

def check_python_packages():
    """Check if required Python packages are installed"""
    required_packages = ['flask', 'requests', 'flask_cors']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    return missing_packages

def get_local_ip():
    """Get local IPv4 address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "127.0.0.1"

def main():
    print("🧠 Cybria AI Assistant Web Interface Setup")
    print("=" * 50)
    
    # Check Python version
    if sys.version_info < (3, 7):
        print("❌ Python 3.7 or higher is required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version.split()[0]} detected")
    
    # Check/install Python packages
    missing_packages = check_python_packages()
    if missing_packages:
        print(f"📦 Installing missing packages: {', '.join(missing_packages)}")
        if not run_command("pip install -r requirements.txt", "Installing Python packages"):
            print("❌ Failed to install Python packages")
            print("   Try running: pip install -r requirements.txt")
            sys.exit(1)
    else:
        print("✅ All Python packages are installed")
    
    # Check Ollama
    print("\n🔍 Checking Ollama status...")
    if not check_ollama():
        print("❌ Ollama is not running or not accessible")
        print("   Please ensure Ollama is installed and running:")
        print("   1. Install Ollama from https://ollama.com")
        print("   2. Start Ollama service")
        print("   3. Run: ollama pull nous-hermes2:7b")
        print("   4. Create Cybria model: ollama create cybria -f cybria.Modelfile")
        print("\n   Then run this setup script again.")
        return False
    else:
        print("✅ Ollama is running")
    
    # Check if Cybria model exists
    print("\n🤖 Checking Cybria model...")
    if run_command("ollama list | findstr cybria", "Checking for Cybria model"):
        print("✅ Cybria model found")
    else:
        print("⚠️  Cybria model not found")
        print("📋 Creating Cybria model...")
        if run_command("ollama create cybria -f cybria.Modelfile", "Creating Cybria model"):
            print("✅ Cybria model created successfully")
        else:
            print("❌ Failed to create Cybria model")
            print("   Please run manually: ollama create cybria -f cybria.Modelfile")
            return False
    
    # Create data directory
    os.makedirs("data", exist_ok=True)
    print("✅ Data directory created")
    
    # Display final instructions
    local_ip = get_local_ip()
    print("\n" + "=" * 50)
    print("🎉 Setup completed successfully!")
    print("\n📋 To start the web interface:")
    print("   python server.py")
    print("\n🌐 Access URLs:")
    print(f"   Desktop: http://127.0.0.1:8000")
    print(f"   Mobile:  http://127.0.0.1:8000/mobile")
    print(f"   Network: http://{local_ip}:8000")
    print("\n🔧 Make sure to:")
    print("   1. Keep Ollama running")
    print("   2. Ensure the Cybria model is loaded")
    print("   3. Check your firewall settings for network access")
    print("\n💡 Troubleshooting:")
    print("   - If connection fails, run: ollama run cybria")
    print("   - Check status at: http://127.0.0.1:8000/api/status")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        if not success:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n👋 Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed with error: {e}")
        sys.exit(1)

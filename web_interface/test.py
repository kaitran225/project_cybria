#!/usr/bin/env python3
"""
Cybria Web Interface Test Suite
Quick tests to verify installation and functionality
"""

import sys
import os
import requests
import json
from datetime import datetime

def test_python_packages():
    """Test that required packages are available"""
    print("🧪 Testing Python packages...")
    
    packages = ['flask', 'flask_cors', 'requests']
    missing = []
    
    for package in packages:
        try:
            __import__(package)
            print(f"  ✅ {package}")
        except ImportError:
            print(f"  ❌ {package} - NOT FOUND")
            missing.append(package)
    
    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False
    else:
        print("✅ All packages available")
        return True

def test_file_structure():
    """Test that required files exist"""
    print("\n🧪 Testing file structure...")
    
    required_files = [
        'server.py',
        'cybria.Modelfile',
        'requirements.txt',
        'templates/index.html',
        'templates/mobile.html'
    ]
    
    missing = []
    
    for file in required_files:
        if os.path.exists(file):
            print(f"  ✅ {file}")
        else:
            print(f"  ❌ {file} - NOT FOUND")
            missing.append(file)
    
    if missing:
        print(f"\n❌ Missing files: {', '.join(missing)}")
        return False
    else:
        print("✅ All required files present")
        return True

def test_ollama_connection():
    """Test Ollama API connection"""
    print("\n🧪 Testing Ollama connection...")
    
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        if response.status_code == 200:
            print("  ✅ Ollama is running")
            
            # Check for models
            data = response.json()
            models = [model.get('name', '') for model in data.get('models', [])]
            
            has_hermes = any('nous-hermes2' in model for model in models)
            has_cybria = any('cybria' in model for model in models)
            
            if has_hermes:
                print("  ✅ nous-hermes2 model found")
            else:
                print("  ⚠️  nous-hermes2 model not found")
                print("     Run: ollama pull nous-hermes2:7b")
            
            if has_cybria:
                print("  ✅ cybria model found")
            else:
                print("  ⚠️  cybria model not found")
                print("     Run: ollama create cybria -f cybria.Modelfile")
            
            return True
            
        else:
            print(f"  ❌ Ollama returned status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("  ❌ Cannot connect to Ollama")
        print("     Ensure Ollama is running: ollama serve")
        return False
    except requests.exceptions.Timeout:
        print("  ❌ Connection timeout")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def test_server_import():
    """Test that server.py can be imported"""
    print("\n🧪 Testing server import...")
    
    try:
        # Add current directory to path
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        
        # Try to import the server module
        import server
        print("  ✅ Server module imports successfully")
        
        # Test key components
        if hasattr(server, 'app'):
            print("  ✅ Flask app found")
        else:
            print("  ❌ Flask app not found")
            return False
            
        if hasattr(server, 'CybriaServer'):
            print("  ✅ CybriaServer class found")
        else:
            print("  ❌ CybriaServer class not found")
            return False
            
        return True
        
    except ImportError as e:
        print(f"  ❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def test_modelfile_syntax():
    """Test Modelfile syntax"""
    print("\n🧪 Testing Modelfile syntax...")
    
    try:
        with open('cybria.Modelfile', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check for required sections
        if 'FROM nous-hermes2:7b' in content:
            print("  ✅ Base model specified")
        else:
            print("  ❌ Base model not found")
            return False
            
        if 'SYSTEM """' in content:
            print("  ✅ System prompt found")
        else:
            print("  ❌ System prompt not found")
            return False
            
        if 'Cybria' in content:
            print("  ✅ Character name found")
        else:
            print("  ❌ Character name not found")
            return False
            
        if 'PARAMETER temperature' in content:
            print("  ✅ Temperature parameter found")
        else:
            print("  ❌ Temperature parameter not found")
            return False
            
        print("✅ Modelfile syntax looks good")
        return True
        
    except FileNotFoundError:
        print("  ❌ cybria.Modelfile not found")
        return False
    except Exception as e:
        print(f"  ❌ Error reading Modelfile: {e}")
        return False

def create_test_report():
    """Create a test report"""
    timestamp = datetime.now().isoformat()
    
    report = {
        "timestamp": timestamp,
        "python_version": sys.version,
        "tests": {
            "packages": test_python_packages(),
            "file_structure": test_file_structure(),
            "ollama_connection": test_ollama_connection(),
            "server_import": test_server_import(),
            "modelfile_syntax": test_modelfile_syntax()
        }
    }
    
    # Calculate overall status
    all_passed = all(report["tests"].values())
    report["overall_status"] = "PASS" if all_passed else "FAIL"
    
    # Save report
    try:
        os.makedirs("data", exist_ok=True)
        with open("data/test_report.json", "w") as f:
            json.dump(report, f, indent=2)
        print(f"\n📊 Test report saved to data/test_report.json")
    except Exception as e:
        print(f"\n⚠️  Could not save test report: {e}")
    
    return report

def main():
    print("🧠 Cybria Web Interface Test Suite")
    print("=" * 40)
    
    report = create_test_report()
    
    print("\n" + "=" * 40)
    print("📊 TEST SUMMARY")
    print("=" * 40)
    
    for test_name, result in report["tests"].items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title():<20} {status}")
    
    print("-" * 40)
    overall = report["overall_status"]
    status_emoji = "✅" if overall == "PASS" else "❌"
    print(f"Overall Status: {status_emoji} {overall}")
    
    if overall == "PASS":
        print("\n🎉 All tests passed! You can start the server:")
        print("   python server.py")
        print("\n   Then access:")
        print("   Desktop: http://127.0.0.1:8000")
        print("   Mobile:  http://127.0.0.1:8000/mobile")
    else:
        print("\n🔧 Some tests failed. Please address the issues above.")
        print("   Run setup.py or setup.bat to resolve dependencies.")
    
    return 0 if overall == "PASS" else 1

if __name__ == "__main__":
    sys.exit(main())

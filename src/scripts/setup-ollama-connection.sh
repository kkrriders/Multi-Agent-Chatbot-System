#!/bin/bash

# Ollama Connection Setup Script for WSL2
# This script ensures permanent Ollama connectivity by:
# 1. Auto-detecting the correct Windows host IP
# 2. Testing connectivity
# 3. Updating configuration
# 4. Starting Ollama if needed on Windows

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "🔍 Setting up Ollama connection..."

# Function to detect Windows host IP
detect_windows_host_ip() {
    echo "📡 Detecting Windows host IP..."
    
    # Method 1: Default gateway (most reliable)
    local gateway_ip=$(ip route show default | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)
    if [[ -n "$gateway_ip" ]]; then
        echo "   Found gateway IP: $gateway_ip"
        if ping -c 1 -W 3 "$gateway_ip" >/dev/null 2>&1; then
            echo "✅ Gateway IP $gateway_ip is reachable"
            echo "$gateway_ip"
            return 0
        else
            echo "❌ Gateway IP $gateway_ip is not reachable"
        fi
    fi
    
    # Method 2: Try common WSL2 host IPs
    local fallback_ips=("172.18.224.1" "172.19.224.1" "172.20.224.1" "172.21.224.1" "192.168.65.2")
    
    echo "   Testing fallback IPs..."
    for ip in "${fallback_ips[@]}"; do
        echo "   Testing $ip..."
        if ping -c 1 -W 3 "$ip" >/dev/null 2>&1; then
            echo "✅ Fallback IP $ip is reachable"
            echo "$ip"
            return 0
        fi
    done
    
    echo "❌ No reachable Windows host IP found"
    return 1
}

# Function to test Ollama connectivity
test_ollama_connection() {
    local host_ip="$1"
    local port="${2:-11434}"
    local url="http://$host_ip:$port/api/version"
    
    echo "🔗 Testing Ollama connection at $url..."
    
    if curl -s -m 10 "$url" >/dev/null 2>&1; then
        echo "✅ Ollama is accessible at $host_ip:$port"
        return 0
    else
        echo "❌ Ollama is not accessible at $host_ip:$port"
        return 1
    fi
}

# Function to update .env file
update_env_file() {
    local host_ip="$1"
    local api_base="http://$host_ip:11434/api"
    
    echo "📝 Updating .env file with new Ollama API base: $api_base"
    
    # Backup existing .env
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Update OLLAMA_API_BASE
    if grep -q "^OLLAMA_API_BASE=" "$ENV_FILE"; then
        sed -i "s|^OLLAMA_API_BASE=.*|OLLAMA_API_BASE=$api_base|" "$ENV_FILE"
    else
        echo "OLLAMA_API_BASE=$api_base" >> "$ENV_FILE"
    fi
    
    echo "✅ Updated OLLAMA_API_BASE to $api_base"
}

# Function to provide Windows setup instructions
show_windows_setup_instructions() {
    local host_ip="$1"
    
    echo ""
    echo "🪟 WINDOWS SETUP REQUIRED:"
    echo "=========================================="
    echo "1. Open PowerShell as Administrator on Windows"
    echo "2. Run: ollama serve --host 0.0.0.0"
    echo "3. If firewall blocks it, allow through Windows Firewall:"
    echo "   - Windows Security > Firewall & network protection"
    echo "   - Allow an app through firewall"
    echo "   - Add ollama.exe and allow on Private networks"
    echo ""
    echo "4. Alternative: Add firewall rule manually:"
    echo "   netsh advfirewall firewall add rule name=\"Ollama\" dir=in action=allow protocol=TCP localport=11434"
    echo ""
    echo "5. Verify Ollama is accessible from WSL:"
    echo "   curl http://$host_ip:11434/api/version"
    echo "=========================================="
}

# Function to create permanent startup solution
create_startup_script() {
    local host_ip="$1"
    
    echo "🔧 Creating permanent startup solution..."
    
    # Create a startup script that can be run automatically
    cat > "$PROJECT_ROOT/start-with-ollama-check.sh" << 'EOF'
#!/bin/bash

# Auto-start script with Ollama connectivity check
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Multi-Agent Chatbot System..."

# Run Ollama connection setup
if [[ -f "$SCRIPT_DIR/scripts/setup-ollama-connection.sh" ]]; then
    echo "🔍 Checking Ollama connection..."
    bash "$SCRIPT_DIR/scripts/setup-ollama-connection.sh"
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Ollama connection verified"
    else
        echo "❌ Ollama connection failed - please check Windows setup"
        exit 1
    fi
else
    echo "⚠️  Ollama setup script not found, using existing configuration"
fi

# Start the system
echo "🎯 Starting chatbot system..."
node start-stable.js
EOF

    chmod +x "$PROJECT_ROOT/start-with-ollama-check.sh"
    
    echo "✅ Created start-with-ollama-check.sh for automatic startup"
}

# Main execution
main() {
    echo "🤖 Multi-Agent Chatbot Ollama Setup"
    echo "====================================="
    
    # Detect Windows host IP
    local host_ip
    if host_ip=$(detect_windows_host_ip); then
        echo "✅ Windows host IP detected: $host_ip"
        
        # Test Ollama connection
        if test_ollama_connection "$host_ip"; then
            echo "✅ Ollama is already accessible!"
            update_env_file "$host_ip"
            create_startup_script "$host_ip"
            echo ""
            echo "🎉 Setup complete! You can now run:"
            echo "   ./start-with-ollama-check.sh"
            echo ""
            return 0
        else
            echo "⚠️  Ollama service not accessible"
            update_env_file "$host_ip"
            show_windows_setup_instructions "$host_ip"
            create_startup_script "$host_ip"
            echo ""
            echo "🔧 After setting up Ollama on Windows, run:"
            echo "   ./start-with-ollama-check.sh"
            echo ""
            return 1
        fi
    else
        echo "❌ Could not detect Windows host IP"
        echo "Please ensure WSL2 networking is configured correctly"
        return 1
    fi
}

# Run main function
main "$@"
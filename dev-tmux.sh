#!/usr/bin/env bash

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "tmux is not installed. Please install tmux first."
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required commands
for cmd in pnpm docker docker-compose; do
    if ! command_exists "$cmd"; then
        echo "Required command '$cmd' is not installed."
        exit 1
    fi
done

# Function to start docker services
start_docker() {
    echo "Starting docker services..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        ./dev.sh start
    else
        ./dev.sh start-local
    fi
}

# Function to setup services
setup_services() {
    echo "Setting up services..."
    echo "Running database migrations..."
    pnpm i
    pnpm kysely migrate latest

    echo "Building database schemas..."
    cd core/schema && pnpm build --env-file ../../.env && cd ../..

    echo "Generating API schema..."
    cd apps/server && mkdir -p dist/ && pnpm generate:swagger && cd ../..

    echo "Building API client..."
    cd core/openapi-spec && pnpm build && cd ../..

    echo "All services are set up!"
}

# Function to setup tmux panes
setup_tmux() {
    echo "Setting up tmux session for server processes..."
    # Create a new tmux session
    tmux new-session -d -s noctf

    # Rename the window
    tmux rename-window -t noctf:0 'noctf'

    # Create first split (now we have 2 panes)
    tmux split-window -h -t noctf:0

    # Create second split (now we have 3 panes)
    tmux split-window -h -t noctf:0.1

    # Resize panes to make them equal size
    tmux select-layout -t noctf:0 even-horizontal

    echo "Starting server processes..."
    # Left: Server
    tmux send-keys -t noctf:0.0 'cd apps/server && pnpm dev:www' C-m

    # Middle: Worker
    tmux send-keys -t noctf:0.1 'cd apps/server && pnpm dev:worker' C-m

    # Right: Web
    tmux send-keys -t noctf:0.2 'cd apps/web && pnpm dev' C-m
}

# Function to cleanup on exit
stop() {
    echo "Cleaning up noctf development environment..."
    
    echo "Stopping tmux session..."
    if tmux kill-session -t noctf 2>/dev/null; then
        echo "✓ Tmux session 'noctf' stopped successfully"
    else
        echo "! No tmux session 'noctf' was running"
    fi

    echo "Stopping docker services..."
    if ./dev.sh stop; then
        echo "✓ Docker services stopped successfully"
    else
        echo "! Error stopping docker services"
        exit 1
    fi

    echo "✓ Cleanup completed successfully"
}

# Main start function
start() {
    echo "Starting noctf development environment..."
    # Start docker services
    start_docker

    # Setup all services
    setup_services

    # Setup tmux and start server processes
    setup_tmux

    # Attach to the session
    echo "Starting tmux session 'noctf'..."
    echo "Use 'tmux attach -t noctf' to attach to the session if you detach."
    echo "Use 'tmux kill-session -t noctf' to stop all services."
    tmux attach -t noctf
}

# Handle command line arguments
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    *)
        echo "Usage: $0 {start|stop}"
        exit 1
        ;;
esac
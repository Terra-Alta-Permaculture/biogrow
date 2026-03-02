#!/bin/bash
export PATH="$HOME/local/node-v20.11.1-darwin-x64/bin:$PATH"
cd "$(dirname "$0")"
exec npx vite --host

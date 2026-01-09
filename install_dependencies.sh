
#!/bin/bash

echo "Installing Protardio Swap Dependencies..."

# Check if bun or npm is available
if command -v bun &> /dev/null; then
    RUNNER="bun"
    INSTALL="bun add"
    DEV="bun add -d"
else
    RUNNER="npm"
    INSTALL="npm install"
    DEV="npm install -D"
fi

echo "Using $RUNNER for installation."

echo "Installing Core Dependencies..."
$INSTALL next@latest react@latest react-dom@latest tailwindcss@latest
$INSTALL drizzle-orm pg

echo "Installing Web3 & Auth..."
$INSTALL @farcaster/auth-kit viem wagmi

echo "Installing Utilities..."
# 'fs' and 'path' are built-in, no install needed for them in node types
$INSTALL zod zustand

echo "Installing Dev Dependencies..."
$DEV typescript @types/node @types/react @types/react-dom drizzle-kit tsx @types/pg

echo "Done! Dependencies installed."
echo "You can now run the helper tools with: npx tsx tools/peek.ts"

#!/bin/bash

# Load Game State Script
# Usage: ./bin/load-game.sh <lobby-id> <game-state-file.json> [server-url]
#
# Examples:
#   ./bin/load-game.sh abc123def456 test/test-data/merger-round.json
#   ./bin/load-game.sh abc123def456 saved-game.json http://localhost:3000
#   ./bin/load-game.sh abc123def456 test/test-data/merger-round.json https://acquire-y6o7.onrender.com

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default server URL
DEFAULT_SERVER="http://localhost:8080"

# Parse arguments
LOBBY_ID="$1"
DATA_FILE="$2"
SERVER_URL="${3:-$DEFAULT_SERVER}"

# Show usage if no arguments
if [ -z "$LOBBY_ID" ] || [ -z "$DATA_FILE" ]; then
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           ${GREEN}Acquire Game State Loader${BLUE}                        ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0 <lobby-id> <game-state-file.json> [server-url]"
    echo ""
    echo -e "${YELLOW}Arguments:${NC}"
    echo "  lobby-id          The lobby ID where the game should be loaded"
    echo "  game-state-file   Path to a JSON file containing the game state"
    echo "  server-url        Optional. Server URL (default: http://localhost:3000)"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 abc123def456 test/test-data/merger-round.json"
    echo "  $0 abc123def456 my-saved-game.json http://localhost:3000"
    echo "  $0 abc123def456 merger-test.json https://acquire-y6o7.onrender.com"
    echo ""
    echo -e "${YELLOW}Available test data files:${NC}"
    if [ -d "test/test-data" ]; then
        for file in test/test-data/*.json; do
            echo "  - $file"
        done
    else
        echo "  (run from project root to see available files)"
    fi
    echo ""
    exit 1
fi

# Check if file exists
if [ ! -f "$DATA_FILE" ]; then
    echo -e "${RED}Error:${NC} File not found: $DATA_FILE"
    exit 1
fi

# Validate JSON
if ! jq empty "$DATA_FILE" 2>/dev/null; then
    echo -e "${RED}Error:${NC} Invalid JSON in file: $DATA_FILE"
    exit 1
fi

# Get file info
FILE_SIZE=$(wc -c < "$DATA_FILE" | tr -d ' ')
PLAYER_COUNT=$(jq '.players | length' "$DATA_FILE" 2>/dev/null || echo "?")
GAME_STATE=$(jq -r '.state // "unknown"' "$DATA_FILE" 2>/dev/null || echo "unknown")

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           ${GREEN}Loading Game State${BLUE}                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Server:     $SERVER_URL"
echo "  Lobby ID:   $LOBBY_ID"
echo "  Data File:  $DATA_FILE"
echo "  File Size:  $FILE_SIZE bytes"
echo "  Players:    $PLAYER_COUNT"
echo "  State:      $GAME_STATE"
echo ""

# Construct the URL
LOAD_URL="${SERVER_URL}/game/${LOBBY_ID}/load"

echo -e "${YELLOW}Sending request to:${NC} $LOAD_URL"
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d @"$DATA_FILE" \
    "$LOAD_URL")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract body (everything except last line)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "${YELLOW}Response:${NC}"
echo "  HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "  ${GREEN}✓ Game state loaded successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Open the game in your browser:"
    echo "     ${SERVER_URL}/game/${LOBBY_ID}"
    echo ""
    echo "  2. Make sure you have a cookie set for one of the players:"
    PLAYERS=$(jq -r '.players[].username' "$DATA_FILE" 2>/dev/null)
    echo "     Players in this game:"
    echo "$PLAYERS" | while read player; do
        echo "       - $player"
    done
    echo ""
elif [ "$HTTP_CODE" = "400" ]; then
    echo -e "  ${RED}✗ Bad request - invalid game state${NC}"
    echo "  Response: $BODY"
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "  ${RED}✗ Lobby not found${NC}"
    echo "  The lobby '$LOBBY_ID' does not exist."
    echo ""
    echo -e "${YELLOW}To load a game, you need to:${NC}"
    echo ""
    echo "  1. Create a lobby first:"
    echo "     - Go to $SERVER_URL"
    echo "     - Enter a username (must match a player in your save file)"
    echo "     - Click 'Create Lobby'"
    echo "     - Copy the lobby ID from the URL"
    echo ""
    echo "  2. Then run this script with that lobby ID:"
    echo "     $0 <new-lobby-id> $DATA_FILE $SERVER_URL"
    echo ""
    echo -e "${YELLOW}Players in your save file:${NC}"
    jq -r '.players[].username' "$DATA_FILE" 2>/dev/null | while read player; do
        echo "     - $player"
    done
    echo ""
    echo -e "${YELLOW}Tip:${NC} Your browser username cookie must match one of these players!"
    exit 1
else
    echo -e "  ${RED}✗ Request failed${NC}"
    echo "  Response: $BODY"
    exit 1
fi

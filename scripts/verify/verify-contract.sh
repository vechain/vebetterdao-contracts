#!/bin/bash

# Check if both arguments are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <contract_name> <contract_address>"
    exit 1
fi

CONTRACT_NAME=$1
CONTRACT_ADDRESS=$2

# Execute the yarn command with the environment variables
dotenv -v NEXT_PUBLIC_APP_ENV=local -v CONTRACT_NAME="$CONTRACT_NAME" -v CONTRACT_ADDRESS="$CONTRACT_ADDRESS" -- yarn verify-contract 
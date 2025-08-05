#!/bin/bash

# Check for correct number of arguments
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input_dir> <output_dir>"
    exit 1
fi

# Set input and output directories from command-line arguments
INPUT_DIR="$1"
OUTPUT_DIR="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set input and output directories
CSS_FILE="$SCRIPT_DIR/style.css"
TEMPLATE_HTML="$SCRIPT_DIR/template.html"
INDEX_MD="$INPUT_DIR/index.md"


# Ensure the output directory exists
mkdir -p "$OUTPUT_DIR"

# Check if the CSS file exists
if [ ! -f "$CSS_FILE" ]; then
    echo "Error: CSS file '$CSS_FILE' not found!"
    exit 1
fi

# Check if the template html file exists
if [ ! -f "$TEMPLATE_HTML" ]; then
    echo "Error: Template file '$TEMPLATE_HTML' not found!"
    exit 1
fi

# Create an index.md file
echo "# VeBetterDao Contracts" > "$INDEX_MD"
echo "" >> "$INDEX_MD"
for file in ./docs/*.md; do
    base_name="$(basename "${file%.md}")"
    echo "- [${base_name}](./${base_name}.html)" >> "$INDEX_MD"
done

# Loop through all Markdown files in the input directory
for file in "$INPUT_DIR"/*.md; do
    # Extract the base filename (e.g., "file.md" -> "file.html")
    output_file="$OUTPUT_DIR/$(basename "${file%.md}.html")"
    
    # Convert the Markdown file to HTML with a Table of Contents
    pandoc "$file" -o "$output_file" --toc --toc-depth=3 --css="$CSS_FILE" --standalone --template="$TEMPLATE_HTML"

    # Print the file being processed
    echo "Converted: $file -> $output_file"
done




echo "All files converted! HTML files are in $OUTPUT_DIR."

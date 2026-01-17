#!/usr/bin/env bash

# Download Polish bank logos from Brandfetch
# Usage: ./download-bank-logos.sh

OUTPUT_DIR="../frontend/public/images/banks"
API_KEY="1id4Z7B5NIBmhyZvJfo"

mkdir -p "$OUTPUT_DIR"

echo "Downloading Polish bank logos from Brandfetch..."

download_logo() {
    local name=$1
    local path=$2
    local url="https://cdn.brandfetch.io/${path}?c=$API_KEY"
    local output_file="$OUTPUT_DIR/$name.webp"

    echo "Downloading $name..."
    curl -s -L \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
        -H "Accept: image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" \
        -H "Referer: https://firedup.app/" \
        "$url" \
        -o "$output_file"

    # Check if it's actually an image
    local file_type=$(file "$output_file" 2>/dev/null | grep -i "image\|RIFF\|PNG\|JPEG")
    if [ -n "$file_type" ] && [ -s "$output_file" ]; then
        echo "  ✓ $name.webp downloaded ($(du -h "$output_file" | cut -f1))"
    else
        echo "  ✗ Failed to download $name (got HTML error page)"
        rm -f "$output_file"
    fi
}

# Download each bank logo
download_logo "alior" "aliorbank.pl/w/256/h/256"
download_logo "millennium" "bankmillennium.pl/w/400/h/400"
download_logo "pekao" "cdmpekao.com.pl/w/400/h/400"
download_logo "bnp" "bnpparibasfortis.com/w/320/h/320"
download_logo "credit-agricole" "credit-agricole.com/w/400/h/400"
download_logo "ing" "ing.com/w/400/h/400/symbol"
download_logo "mbank" "mbank.pl/w/400/h/400"
download_logo "pko" "pkobp.pl/w/400/h/400"
download_logo "revolut" "revolut.com/w/400/h/400/theme/light/logo"
download_logo "santander" "santander.pl/w/400/h/400"
download_logo "wise" "wise.com/w/400/h/400/theme/light/logo"

echo ""
echo "Done! Logos saved to $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"

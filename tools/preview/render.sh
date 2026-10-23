#!/bin/sh
# /work = โฟลเดอร์ .docx, /fonts = โฟลเดอร์ฟอนต์ของผู้ใช้ (อ่านอย่างเดียว; ใช้เฉพาะ TH Sarabun)
set -eu
mkdir -p /usr/share/fonts/thdocs /work/preview
find /fonts -maxdepth 2 -iname '*sarabun*' \( -iname '*.ttf' -o -iname '*.otf' \) -exec cp {} /usr/share/fonts/thdocs/ \; 2>/dev/null || true
fc-cache -f >/dev/null
fc-list | grep -qi "TH SarabunPSK" || echo "WARN: ไม่พบฟอนต์ TH SarabunPSK — ภาพจะใช้ฟอนต์อื่นแทน"
soffice --headless --convert-to pdf --outdir /work/preview /work/*.docx >/dev/null 2>&1
for pdf in /work/preview/*.pdf; do
  name=$(basename "$pdf" .pdf)
  pages=$(pdfinfo "$pdf" | awk '/^Pages:/ {print $2}')
  pdftoppm -png -r 80 "$pdf" "/work/preview/$name"
  echo "$name pages=$pages"
done

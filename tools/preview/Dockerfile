# LibreOffice headless สำหรับแปลง .docx → PDF → PNG เพื่อตรวจการจัดหน้าด้วยภาพ
# base ปักเป็น digest (ตรวจเมื่อ 2026-10-24) — อัปเดตเมื่อต้องการแพตช์ความปลอดภัยใหม่
FROM debian:trixie-slim@sha256:62bd423aeee912639ca8ee681c2b762cb3e25137e0a92b20be455898a9f034ad
RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-writer-nogui poppler-utils fontconfig \
 && rm -rf /var/lib/apt/lists/*
COPY render.sh /usr/local/bin/render.sh
RUN chmod +x /usr/local/bin/render.sh
ENTRYPOINT ["/usr/local/bin/render.sh"]

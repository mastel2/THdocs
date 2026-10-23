# LibreOffice headless สำหรับแปลง .docx → PDF → PNG เพื่อตรวจการจัดหน้าด้วยภาพ
# TODO: ปักเป็น digest (debian:trixie-slim@sha256:...) เมื่อ build ครั้งแรก
FROM debian:trixie-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-writer-nogui poppler-utils fontconfig \
 && rm -rf /var/lib/apt/lists/*
COPY render.sh /usr/local/bin/render.sh
RUN chmod +x /usr/local/bin/render.sh
ENTRYPOINT ["/usr/local/bin/render.sh"]

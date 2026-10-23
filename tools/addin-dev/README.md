# ทดลอง Word add-in บนเครื่อง

1. `cd apps/web && npx next build && npx next start -p 3100`
2. `node tools/addin-dev/https-proxy.mjs 3100 3443` (ใช้ `out/devcert/localhost.pfx` รหัส `thdocs-dev` — ไฟล์นี้ไม่อยู่ใน git)
3. ดาวน์โหลด manifest: `curl https://localhost:3443/addin/manifest.xml -o out/addin-manifest.xml`
4. ลงทะเบียนเป็น developer add-in (ระดับผู้ใช้): ค่า `HKCU\Software\Microsoft\Office\16.0\Wef\Developer` ชื่อ `THdocsManifest` = พาธของ manifest
5. เปิด Word → แทรก (Insert) → โปรแกรมเสริมของฉัน (My Add-ins) → Developer Add-ins → THdocs

สร้างใบรับรองใหม่: `New-SelfSignedCertificate -DnsName localhost ...` แล้วเพิ่มเข้า `Cert:\CurrentUser\Root` ด้วย `certutil -user -addstore Root`

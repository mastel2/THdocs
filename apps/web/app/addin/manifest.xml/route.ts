/**
 * manifest ของ Word add-in — สร้างตามโดเมนที่ให้บริการจริง
 * THDOCS_PUBLIC_URL (เช่น https://thdocs.com) กำหนดเองได้ ไม่งั้นใช้ origin ของคำขอ
 * Office บังคับให้ทุก URL เป็น https
 */
export const dynamic = "force-dynamic";

/** รหัสประจำ add-in — ห้ามเปลี่ยน (Office ใช้แยกแยะ add-in และค่าที่ผู้ใช้ตั้งไว้) */
const ADDIN_ID = "6f0c9a3e-2b8d-4c71-9e54-1a7d3f2b8c90";

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

function baseUrl(req: Request): string {
  const fixed = process.env.THDOCS_PUBLIC_URL?.replace(/\/$/, "");
  if (fixed) return fixed;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3100";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export function GET(req: Request) {
  const b = xml(baseUrl(req));
  const img = (size: number) => `${b}/addin/icon/${size}`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
  xsi:type="TaskPaneApp">
  <Id>${ADDIN_ID}</Id>
  <Version>0.1.0.0</Version>
  <ProviderName>THdocs</ProviderName>
  <DefaultLocale>th-TH</DefaultLocale>
  <DisplayName DefaultValue="THdocs" />
  <Description DefaultValue="ร่างหนังสือราชการไทยด้วย AI แล้วจัดรูปแบบตามระเบียบงานสารบรรณ" />
  <IconUrl DefaultValue="${img(32)}" />
  <HighResolutionIconUrl DefaultValue="${img(64)}" />
  <SupportUrl DefaultValue="${b}/" />
  <Hosts>
    <Host Name="Document" />
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="WordApi" MinVersion="1.1" />
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="${b}/addin" />
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
        <DesktopFormFactor>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="THdocs.Group">
                <Label resid="Group.Label" />
                <Icon>
                  <bt:Image size="16" resid="Icon.16" />
                  <bt:Image size="32" resid="Icon.32" />
                  <bt:Image size="80" resid="Icon.80" />
                </Icon>
                <Control xsi:type="Button" id="THdocs.Open">
                  <Label resid="Button.Label" />
                  <Supertip>
                    <Title resid="Button.Label" />
                    <Description resid="Button.Tooltip" />
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="Icon.16" />
                    <bt:Image size="32" resid="Icon.32" />
                    <bt:Image size="80" resid="Icon.80" />
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>THdocsPane</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url" />
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="Icon.16" DefaultValue="${img(16)}" />
        <bt:Image id="Icon.32" DefaultValue="${img(32)}" />
        <bt:Image id="Icon.80" DefaultValue="${img(80)}" />
      </bt:Images>
      <bt:Urls>
        <bt:Url id="Taskpane.Url" DefaultValue="${b}/addin" />
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="Group.Label" DefaultValue="THdocs" />
        <bt:String id="Button.Label" DefaultValue="ร่างหนังสือ" />
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="Button.Tooltip" DefaultValue="ร่างหนังสือราชการด้วย AI แล้วแทรกลงเอกสารตามรูปแบบระเบียบงานสารบรรณ" />
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

import { it, expect } from "vitest";
import { fontCategory, fontDisplayName, orderFamilies } from "./catalog";

it("maps the six bundled families to Chinese names and categories", () => {
  expect(fontDisplayName("Noto Sans SC")).toBe("思源黑体");
  expect(fontDisplayName("Noto Serif SC")).toBe("思源宋体");
  expect(fontDisplayName("LXGW WenKai")).toBe("霞鹜文楷");
  expect(fontDisplayName("ZCOOL XiaoWei")).toBe("站酷小薇体");
  expect(fontDisplayName("ZCOOL KuaiLe")).toBe("站酷快乐体");
  expect(fontDisplayName("Inter")).toBe("Inter");
  expect(fontCategory("Noto Sans SC")).toBe("通用");
  expect(fontCategory("Noto Serif SC")).toBe("通用");
  expect(fontCategory("LXGW WenKai")).toBe("文艺");
  expect(fontCategory("ZCOOL XiaoWei")).toBe("文艺");
  expect(fontCategory("ZCOOL KuaiLe")).toBe("标题");
  expect(fontCategory("Inter")).toBe("西文");
});

it("shows uploaded families unchanged without inventing a category", () => {
  expect(fontDisplayName("自己上传的字体")).toBe("自己上传的字体");
  expect(fontCategory("自己上传的字体")).toBe(null);
});

it("orders bundled families by catalogue priority and keeps unknowns last", () => {
  expect(
    orderFamilies(["Unknown", "Inter", "Noto Serif SC", "LXGW WenKai"]),
  ).toEqual(["Noto Serif SC", "LXGW WenKai", "Inter", "Unknown"]);
});

it("prevents Latin-only fonts for a CJK target but keeps English and cursor choices available", async () => {
  const { fontUnavailableReason } = await import("./catalog");
  expect(fontUnavailableReason("Inter", "Design 海报")).toContain("西文");
  expect(
    fontUnavailableReason("Inter", "Long English prefix before 中文"),
  ).toContain("西文");
  expect(fontUnavailableReason("Inter", "全角，标点。")).toContain("西文");
  expect(fontUnavailableReason("Inter", "Poster 2026")).toBeUndefined();
  expect(fontUnavailableReason("Inter", "")).toBeUndefined();
  expect(fontUnavailableReason("Noto Sans SC", "海报")).toBeUndefined();
  expect(fontUnavailableReason("用户上传", "海报")).toBeUndefined();
});

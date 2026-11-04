export type FontCategory = "通用" | "文艺" | "标题" | "西文";
const catalog: Record<string, { label: string; category: FontCategory }> = {
  "Noto Sans SC": { label: "思源黑体", category: "通用" },
  "Noto Serif SC": { label: "思源宋体", category: "通用" },
  "LXGW WenKai": { label: "霞鹜文楷", category: "文艺" },
  "ZCOOL XiaoWei": { label: "站酷小薇体", category: "文艺" },
  "ZCOOL KuaiLe": { label: "站酷快乐体", category: "标题" },
  "Ma Shan Zheng": { label: "马善政毛笔楷书", category: "文艺" },
  "Long Cang": { label: "龙藏手书", category: "文艺" },
  "ZCOOL QingKe HuangYou": { label: "站酷庆科黄油体", category: "标题" },
  "Liu Jian Mao Cao": { label: "刘建毛草", category: "文艺" },
  Inter: { label: "Inter", category: "西文" },
};
export function fontDisplayName(family: string): string {
  return catalog[family]?.label ?? family;
}
export function fontCategory(family: string): FontCategory | null {
  return catalog[family]?.category ?? null;
}
export function orderFamilies(families: string[]): string[] {
  const priority = Object.keys(catalog);
  const rank = (family: string) => {
    const index = priority.indexOf(family);
    return index < 0 ? priority.length : index;
  };
  return [...new Set(families)].sort((a, b) => rank(a) - rank(b));
}

/** Known bundled Latin faces cannot render CJK; uploaded families retain server checks. */
export function fontUnavailableReason(
  family: string,
  targetText: string,
): string | undefined {
  if (
    fontCategory(family) === "西文" &&
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u.test(
      targetText,
    )
  )
    return "此字体仅支持西文，请选择中文字体或仅选中英文";
  return undefined;
}

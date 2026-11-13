import { theme } from "antd";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UIProvider } from "./UIProvider";

describe("shared site appearance", () => {
  it("uses the installed Ant Design defaults for color and control sizing", () => {
    function TokenProbe() {
      const { token } = theme.useToken();
      return createElement(
        "output",
        null,
        [
          token.colorPrimary,
          token.colorText,
          token.colorBgLayout,
          token.fontFamily,
          token.controlHeight,
          token.borderRadius,
        ].join("|"),
      );
    }
    const html = renderToStaticMarkup(
      createElement(UIProvider, {
        children: createElement(TokenProbe),
      }),
    );
    expect(html).toContain(renderToStaticMarkup(createElement(TokenProbe)));
  });
});

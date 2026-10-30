package integration_test

import (
	"context"
	"fastposter/server/internal/document"
	"fastposter/server/internal/exports"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRenderMixedFontFamilies(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("set FASTPOSTER_RENDER_TEST=1 for actual browser test")
	}
	r, doc := renderFixture(t)
	root := repoRoot(t)
	doc.Fonts = append(doc.Fonts, document.FontRef{AssetID: "font-2", Version: "1", Family: "Inter", Weight: 400, Style: "normal"})
	doc.TextBlocks[0].Content.Content[0].Content = append(doc.TextBlocks[0].Content.Content[0].Content, document.Node{Type: "text", Text: " FastPoster", Marks: []document.Mark{{Type: "textStyle", Attrs: map[string]any{"fontId": "font-2", "fontSize": float64(40)}}}})
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	_, report, e := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: []exports.ResolvedFont{{AssetID: "font-1", Version: "1", Path: filepath.Join(root, "assets/fonts/NotoSansSC-VF.ttf"), Weight: 400, Style: "normal"}, {AssetID: "font-2", Version: "1", Path: filepath.Join(root, "assets/fonts/Inter-VF.ttf"), Weight: 400, Style: "normal"}}})
	if e != nil {
		t.Fatal(e)
	}
	if report.Overflow {
		t.Fatal("mixed font layout overflowed")
	}
}

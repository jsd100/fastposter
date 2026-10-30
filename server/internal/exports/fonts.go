package exports

import (
	"fastposter/server/internal/document"
	"fmt"
)

func validateFontFaces(d document.Document) error {
	refs := map[string]document.FontRef{}
	for _, f := range d.Fonts {
		refs[f.AssetID] = f
	}
	for _, block := range d.TextBlocks {
		var walk func(document.Node) error
		walk = func(n document.Node) error {
			if n.Type == "text" {
				id, weight, style := block.DefaultStyle.FontID, block.DefaultStyle.FontWeight, "normal"
				bold, italic := false, false
				for _, m := range n.Marks {
					if m.Type == "textStyle" {
						if v, ok := m.Attrs["fontId"].(string); ok {
							id = v
						}
						if v, ok := m.Attrs["fontWeight"].(float64); ok {
							weight = int(v)
						}
					}
					bold = bold || m.Type == "bold"
					italic = italic || m.Type == "italic"
				}
				if bold {
					weight = 700
				}
				if italic {
					style = "italic"
				}
				ref, ok := refs[id]
				if !ok {
					return fmt.Errorf("font reference unavailable: %s", id)
				}
				available := false
				for _, candidate := range d.Fonts {
					if candidate.Family == ref.Family && candidate.Weight == weight && candidate.Style == style {
						available = true
						break
					}
				}
				if !available {
					return fmt.Errorf("font weight unavailable: %s %d %s", id, weight, style)
				}
			}
			for _, child := range n.Content {
				if e := walk(child); e != nil {
					return e
				}
			}
			return nil
		}
		if e := walk(block.Content); e != nil {
			return e
		}
	}
	return nil
}

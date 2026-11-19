package fontfile

import (
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
)

func missingFace() error {
	return domain.E("MISSING_FONT", "所选字体缺少字重或斜体版本")
}

// CheckReferences is the inexpensive part of coverage validation. Weight
// support requires the immutable font bytes and is checked outside job creation.
func CheckReferences(d document.Document) error {
	return walkFontRuns(d, func(_ document.Node, _ int, _ string, _ []document.FontRef) error {
		return nil
	})
}

func CheckDocument(d document.Document, load func(document.FontRef) ([]byte, error)) error {
	type key struct{ id, version string }
	cache := map[key]*Face{}
	failures := map[key]error{}
	order := []key{}
	var cachedBytes int

	read := func(ref document.FontRef) (*Face, error) {
		k := key{ref.AssetID, ref.Version}
		if face := cache[k]; face != nil {
			return face, nil
		}
		if e := failures[k]; e != nil {
			return nil, e
		}
		bytes, e := load(ref)
		if e != nil {
			failures[k] = e
			return nil, e
		}
		face, e := Inspect(bytes)
		if e != nil {
			failures[k] = e
			return nil, e
		}
		for cachedBytes+len(face.Data) > 64<<20 && len(order) > 0 {
			oldest := order[0]
			order = order[1:]
			cachedBytes -= len(cache[oldest].Data)
			delete(cache, oldest)
		}
		cache[k] = face
		order = append(order, k)
		cachedBytes += len(face.Data)
		return face, nil
	}

	return walkFontRuns(d, func(n document.Node, weight int, style string, candidates []document.FontRef) error {
		var firstError error
		for _, candidate := range candidates {
			face, e := read(candidate)
			if e != nil {
				if candidate.Weight == weight {
					return e
				}
				if firstError == nil {
					firstError = e
				}
				continue
			}
			if face.supports(weight, style) {
				return face.CheckText(n.Text)
			}
		}
		if firstError != nil {
			return firstError
		}
		return missingFace()
	})
}

func walkFontRuns(d document.Document, visit func(document.Node, int, string, []document.FontRef) error) error {
	refs := map[string]document.FontRef{}
	type familyStyle struct{ family, style string }
	families := map[familyStyle][]document.FontRef{}
	for _, ref := range d.Fonts {
		refs[ref.AssetID] = ref
		key := familyStyle{ref.Family, ref.Style}
		families[key] = append(families[key], ref)
	}

	var walk func(document.Node, document.InlineStyle) error
	walk = func(n document.Node, base document.InlineStyle) error {
		if n.Type == "text" {
			id, weight, style := base.FontID, base.FontWeight, "normal"
			bold := false
			for _, mark := range n.Marks {
				switch mark.Type {
				case "textStyle":
					if v, ok := mark.Attrs["fontId"].(string); ok {
						id = v
					}
					switch v := mark.Attrs["fontWeight"].(type) {
					case int:
						weight = v
					case float64:
						weight = int(v)
					}
				case "bold":
					bold = true
				case "italic":
					style = "italic"
				}
			}
			if bold {
				weight = 700
			}
			ref, ok := refs[id]
			if !ok {
				return domain.E("MISSING_FONT", "缺少字体引用")
			}
			faces := families[familyStyle{ref.Family, style}]
			if len(faces) == 0 {
				return missingFace()
			}
			// Order exact nominal faces before variable fallbacks while preserving
			// the same document order within each tier.
			candidates := make([]document.FontRef, 0, len(faces))
			for _, face := range faces {
				if face.Weight == weight {
					candidates = append(candidates, face)
				}
			}
			for _, face := range faces {
				if face.Weight != weight {
					candidates = append(candidates, face)
				}
			}
			return visit(n, weight, style, candidates)
		}
		for _, child := range n.Content {
			if e := walk(child, base); e != nil {
				return e
			}
		}
		return nil
	}
	for _, block := range d.TextBlocks {
		if e := walk(block.Content, block.DefaultStyle); e != nil {
			return e
		}
	}
	return nil
}

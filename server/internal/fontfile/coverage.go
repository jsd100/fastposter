package fontfile

import (
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"strconv"
)

func CheckDocument(d document.Document, load func(document.FontRef) ([]byte, error)) error {
	cache := map[string]*Face{}
	order := []string{}
	var cachedBytes int
	refs := map[string]document.FontRef{}
	for _, ref := range d.Fonts {
		refs[ref.AssetID] = ref
	}
	var visit func(document.Node, document.InlineStyle) error
	visit = func(n document.Node, base document.InlineStyle) error {
		if n.Type == "text" {
			id, weight, style := base.FontID, base.FontWeight, "normal"
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
					weight = 700
				case "italic":
					style = "italic"
				}
			}
			for _, mark := range n.Marks {
				if mark.Type == "bold" {
					weight = 700
				}
				if mark.Type == "italic" {
					style = "italic"
				}
			}
			ref, ok := refs[id]
			if !ok {
				return domain.E("MISSING_FONT", "缺少字体引用")
			}
			// An exact nominal face wins; otherwise a variable face from the
			// same authorized family may cover the requested continuous weight.
			candidates := []document.FontRef{}
			for _, f := range d.Fonts {
				if f.Family != ref.Family || f.Style != style {
					continue
				}
				if f.Weight == weight {
					candidates = append([]document.FontRef{f}, candidates...)
				} else {
					candidates = append(candidates, f)
				}
			}
			found := false
			for _, candidate := range candidates {
				key := candidate.AssetID + "@" + candidate.Version + "@" + strconv.Itoa(weight) + "@" + style
				face := cache[key]
				if face == nil {
					data, err := load(candidate)
					if err != nil {
						continue
					}
					face, err = ParseNormalized(data, weight, style)
					if err != nil {
						continue
					}
					for cachedBytes+len(face.Data) > 64<<20 && len(order) > 0 {
						old := order[0]
						order = order[1:]
						cachedBytes -= len(cache[old].Data)
						delete(cache, old)
					}
					cache[key] = face
					order = append(order, key)
					cachedBytes += len(face.Data)
				}
				if e := face.CheckText(n.Text); e != nil {
					return e
				}
				found = true
				break
			}
			if !found {
				return domain.E("MISSING_FONT", "所选字体缺少字重或斜体版本")
			}
		}
		for _, child := range n.Content {
			if e := visit(child, base); e != nil {
				return e
			}
		}
		return nil
	}
	for _, block := range d.TextBlocks {
		if e := visit(block.Content, block.DefaultStyle); e != nil {
			return e
		}
	}
	return nil
}

package fontfile

import (
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
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
			var candidate *document.FontRef
			for _, f := range d.Fonts {
				if f.Family == ref.Family && f.Weight == weight && f.Style == style {
					copy := f
					candidate = &copy
					break
				}
			}
			if candidate == nil {
				return domain.E("MISSING_FONT", "所选字体缺少字重或斜体版本")
			}
			key := candidate.AssetID + "@" + candidate.Version
			face := cache[key]
			var e error
			if face == nil {
				data, err := load(*candidate)
				if err != nil {
					return err
				}
				face, err = ParseNormalized(data, candidate.Weight, candidate.Style)
				if err != nil {
					return err
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
			if e = face.CheckText(n.Text); e != nil {
				return e
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

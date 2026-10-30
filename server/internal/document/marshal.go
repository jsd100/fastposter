package document

import "encoding/json"

// Canonical JSON keeps the same array shape as PosterDocument and Tiptap,
// including a newly created empty paragraph.
func (d Document) MarshalJSON() ([]byte, error) {
	type plain Document
	out := plain(d)
	if out.Fonts == nil {
		out.Fonts = []FontRef{}
	}
	if out.TextBlocks == nil {
		out.TextBlocks = []TextBlock{}
	}
	return json.Marshal(out)
}
func (n Node) MarshalJSON() ([]byte, error) {
	if n.Type == "doc" || n.Type == "paragraph" {
		content := n.Content
		if content == nil {
			content = []Node{}
		}
		return json.Marshal(struct {
			Type    string `json:"type"`
			Content []Node `json:"content"`
		}{n.Type, content})
	}
	type plain Node
	return json.Marshal(plain(n))
}

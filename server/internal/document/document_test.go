package document

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestCanonicalEmptyRichTextContainers(t *testing.T) {
	d := Document{Fonts: nil, TextBlocks: nil}
	raw, e := json.Marshal(d)
	if e != nil {
		t.Fatal(e)
	}
	if bytes.Contains(raw, []byte(`"fonts":null`)) || bytes.Contains(raw, []byte(`"textBlocks":null`)) {
		t.Fatal("empty document arrays must remain arrays")
	}
	raw, e = json.Marshal(Node{Type: "paragraph"})
	if e != nil {
		t.Fatal(e)
	}
	if string(raw) != `{"type":"paragraph","content":[]}` {
		t.Fatalf("empty paragraph must retain content array: %s", raw)
	}
}

package document

import "errors"

var (
	// ErrGradientWritesDisabled is returned when a deployment has not enabled
	// gradient document writes. Reads and exports of existing v2 documents are
	// never affected by this gate.
	ErrGradientWritesDisabled = errors.New("gradient writes are disabled for this deployment")
	// ErrSchemaDowngrade protects stored v2 documents from being replaced by
	// a v1 payload, including requests that carry a current revision token.
	ErrSchemaDowngrade = errors.New("schema version cannot be downgraded from v2 to v1")
)

// WritePolicy is the single compatibility gate applied at every document
// write boundary. GradientWrites defaults to false so an older deployment
// keeps accepting only the workflow it understands.
type WritePolicy struct {
	GradientWrites bool
}

// CheckWrite validates an incoming document before it reaches storage.
// currentVersion is the stored document's version; zero means this is a
// create. Structural validation always runs first so callers do not need to
// remember to invoke Validate separately.
func (p WritePolicy) CheckWrite(currentVersion int, d Document) error {
	if e := Validate(d); e != nil {
		return e
	}
	if currentVersion == 2 && d.SchemaVersion == 1 {
		return ErrSchemaDowngrade
	}
	introducesV2 := d.SchemaVersion == 2 && currentVersion < 2
	if !p.GradientWrites && (introducesV2 || containsGradient(d)) {
		return ErrGradientWritesDisabled
	}
	return nil
}

func containsGradient(d Document) bool {
	for _, b := range d.TextBlocks {
		if b.DefaultStyle.Color.Gradient != nil || nodeHasGradient(b.Content) {
			return true
		}
	}
	return false
}

func nodeHasGradient(n Node) bool {
	for _, m := range n.Marks {
		if value, ok := m.Attrs["color"]; m.Type == "textStyle" && ok {
			color, _ := decodeMarkColor(value) // CheckWrite already validated the document.
			if color.Gradient != nil {
				return true
			}
		}
	}
	for i := range n.Content {
		if nodeHasGradient(n.Content[i]) {
			return true
		}
	}
	return false
}

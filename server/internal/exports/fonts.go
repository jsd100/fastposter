package exports

import (
	"fastposter/server/internal/document"
	"fastposter/server/internal/fontfile"
)

func validateFontFaces(d document.Document) error {
	return fontfile.CheckReferences(d)
}

package templates

import (
	"fastposter/server/internal/document"
)

const MaxCompressed int64 = 80 << 20
const MaxExpanded int64 = 120 << 20
const MaxFiles = 20

type Asset struct {
	AssetID string `json:"assetId"`
	Version string `json:"version"`
	Path    string `json:"path"`
	SHA256  string `json:"sha256"`
}
type Font struct {
	AssetID string `json:"assetId"`
	Version string `json:"version"`
	Family  string `json:"family"`
	Weight  int    `json:"weight"`
	Style   string `json:"style"`
	SHA256  string `json:"sha256"`
}
type Manifest struct {
	Format       string  `json:"format"`
	Version      int     `json:"version"`
	Title        string  `json:"title"`
	DocumentPath string  `json:"documentPath"`
	Assets       []Asset `json:"assets"`
	Fonts        []Font  `json:"fonts"`
}
type Archive struct {
	Manifest       Manifest
	Document       document.Document
	BackgroundPath string
}

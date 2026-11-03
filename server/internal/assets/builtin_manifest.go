package assets

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/fontfile"
	"os"
	"path/filepath"
	"strings"
)

type builtinFace struct {
	ID     string `json:"id"`
	Family string `json:"family"`
	File   string `json:"file"`
	Weight int    `json:"weight"`
	Style  string `json:"style"`
}

type builtinManifest struct {
	Version  int               `json:"version"`
	Files    map[string]string `json:"files"`
	Sources  map[string]string `json:"sources"`
	Licenses []string          `json:"licenses"`
	Faces    []builtinFace     `json:"faces"`
}

func loadBuiltinManifest(root string) (builtinManifest, error) {
	var manifest builtinManifest
	raw, e := os.ReadFile(filepath.Join(root, "assets/fonts/manifest.json"))
	if e != nil {
		return manifest, e
	}
	if e = json.Unmarshal(raw, &manifest); e != nil {
		return manifest, e
	}
	if manifest.Version < 1 || len(manifest.Faces) == 0 {
		return manifest, domain.E("MISSING_FONT", "内置字体清单为空")
	}
	seen := map[string]bool{}
	validated := map[string][]byte{}
	for _, face := range manifest.Faces {
		if face.ID == "" || face.Family == "" || face.File == "" || seen[face.ID] {
			return manifest, domain.E("MISSING_FONT", "内置字体清单包含无效条目")
		}
		seen[face.ID] = true
		want, ok := manifest.Files[face.File]
		if !ok || want == "" {
			return manifest, domain.E("MISSING_FONT", "内置字体清单缺少文件校验值")
		}
		data, ok := validated[face.File]
		if !ok {
			data, e = os.ReadFile(filepath.Join(root, "assets/fonts", face.File))
			if e != nil {
				return manifest, e
			}
			sum := sha256.Sum256(data)
			if !strings.EqualFold(hex.EncodeToString(sum[:]), want) {
				return manifest, domain.E("MISSING_FONT", "内置字体文件校验失败")
			}
			validated[face.File] = data
		}
		if _, e = fontfile.ParseNormalized(data, face.Weight, face.Style); e != nil {
			return manifest, e
		}
	}
	return manifest, nil
}

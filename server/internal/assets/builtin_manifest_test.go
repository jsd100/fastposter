package assets

import (
	"crypto/sha256"
	"encoding/hex"
	"fastposter/server/internal/fontfile"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

func TestBuiltinManifestDeclaresTenFamilies(t *testing.T) {
	root, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	manifest, e := loadBuiltinManifest(root)
	if e != nil {
		t.Fatal(e)
	}
	if len(manifest.Faces) != 15 {
		t.Fatalf("faces %d, want 15", len(manifest.Faces))
	}
	want := map[string][]int{
		"Noto Sans SC":          {400, 700, 900},
		"Noto Serif SC":         {400, 700, 900},
		"LXGW WenKai":           {400},
		"ZCOOL KuaiLe":          {400},
		"ZCOOL XiaoWei":         {400},
		"Inter":                 {400, 700},
		"Ma Shan Zheng":         {400},
		"Long Cang":             {400},
		"ZCOOL QingKe HuangYou": {400},
		"Liu Jian Mao Cao":      {400},
	}
	faces := map[string]builtinFace{}
	weights := map[string][]int{}
	for _, face := range manifest.Faces {
		if faces[face.ID].ID != "" {
			t.Fatalf("duplicate face id %s", face.ID)
		}
		faces[face.ID] = face
		weights[face.Family] = append(weights[face.Family], face.Weight)
		if face.Style != "normal" {
			t.Fatalf("%s declares style %q", face.ID, face.Style)
		}
		data, e := os.ReadFile(filepath.Join(root, "assets/fonts", face.File))
		if e != nil {
			t.Fatal(e)
		}
		if _, e = fontfile.ParseNormalized(data, face.Weight, face.Style); e != nil {
			t.Fatalf("%s declared weight is not provided by its file: %v", face.ID, e)
		}
	}
	if len(weights) != 10 {
		t.Fatalf("families %d, want 10", len(weights))
	}
	for family, wantWeights := range want {
		got := slices.Clone(weights[family])
		slices.Sort(got)
		if !slices.Equal(got, wantWeights) {
			t.Fatalf("%s weights %v, want %v", family, got, wantWeights)
		}
	}
	for _, id := range []string{
		"builtin-noto-sc-400", "builtin-noto-sc-700", "builtin-inter-400", "builtin-inter-700",
		"builtin-noto-sc-900", "builtin-noto-serif-sc-400", "builtin-noto-serif-sc-700",
		"builtin-noto-serif-sc-900", "builtin-lxgw-wenkai-400", "builtin-zcool-kuaile-400",
		"builtin-zcool-xiaowei-400",
	} {
		if _, ok := faces[id]; !ok {
			t.Fatalf("missing face %s", id)
		}
	}
	for file, wantSum := range manifest.Files {
		data, e := os.ReadFile(filepath.Join(root, "assets/fonts", file))
		if e != nil {
			t.Fatal(e)
		}
		sum := sha256.Sum256(data)
		if hex.EncodeToString(sum[:]) != wantSum {
			t.Fatalf("%s hash mismatch", file)
		}
	}
	for _, license := range manifest.Licenses {
		if _, e := os.Stat(filepath.Join(root, "assets/fonts", license)); e != nil {
			t.Fatalf("missing license %s: %v", license, e)
		}
	}
}

func TestBuiltinFontSourcesArePinned(t *testing.T) {
	root, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	manifest, e := loadBuiltinManifest(root)
	if e != nil {
		t.Fatal(e)
	}
	blob := regexp.MustCompile(`/blob/[0-9a-f]{40}/`)
	release := regexp.MustCompile(`/releases/tag/[^/]+$`)
	for file := range manifest.Files {
		source, ok := manifest.Sources[file]
		if !ok || source == "" {
			t.Fatalf("%s has no declared source", file)
		}
		for _, moving := range []string{"/tree/main", "/blob/main", "/tree/master", "/blob/master"} {
			if strings.Contains(source, moving) {
				t.Fatalf("%s source tracks a moving branch: %s", file, source)
			}
		}
		if !blob.MatchString(source) && !release.MatchString(source) {
			t.Fatalf("%s source is not pinned to a commit or release: %s", file, source)
		}
	}
}

func TestBuiltinChineseFamiliesCoverShortSentences(t *testing.T) {
	root, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	manifest, e := loadBuiltinManifest(root)
	if e != nil {
		t.Fatal(e)
	}
	const sentence = "你好，世界！\n春江潮水连海平，海上明月共潮生。"
	for _, face := range manifest.Faces {
		if face.Family == "Inter" {
			continue
		}
		data, e := os.ReadFile(filepath.Join(root, "assets/fonts", face.File))
		if e != nil {
			t.Fatal(e)
		}
		parsed, e := fontfile.ParseNormalized(data, face.Weight, face.Style)
		if e != nil {
			t.Fatal(e)
		}
		if e = parsed.CheckText(sentence); e != nil {
			t.Fatalf("%s %d: %v", face.Family, face.Weight, e)
		}
	}
}

func TestBuiltinInterStillRejectsChinese(t *testing.T) {
	root, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	manifest, e := loadBuiltinManifest(root)
	if e != nil {
		t.Fatal(e)
	}
	for _, face := range manifest.Faces {
		if face.ID != "builtin-inter-400" {
			continue
		}
		data, e := os.ReadFile(filepath.Join(root, "assets/fonts", face.File))
		if e != nil {
			t.Fatal(e)
		}
		parsed, e := fontfile.ParseNormalized(data, face.Weight, face.Style)
		if e != nil {
			t.Fatal(e)
		}
		if e = parsed.CheckText("你好"); e == nil {
			t.Fatal("Inter silently covers Chinese")
		}
		return
	}
	t.Fatal("missing builtin-inter-400")
}

package config

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadResolvesSameDataRoot(t *testing.T) {
	root := t.TempDir()
	c, err := Load(map[string]string{"MYSQL_DSN": "poster:secret@tcp(127.0.0.1:3306)/fastposter", "APP_DATA_DIR": "var/data"}, root)
	if err != nil {
		t.Fatal(err)
	}
	if c.AbsoluteDataDir != filepath.Join(root, "var/data") {
		t.Fatalf("data root = %q", c.AbsoluteDataDir)
	}
	if c.RedisAddr != "" {
		t.Fatal("redis must be optional")
	}
}
func TestMissingDSNExplainsConfig(t *testing.T) {
	_, err := Load(map[string]string{}, t.TempDir())
	if err == nil || !strings.Contains(err.Error(), "MYSQL_DSN") {
		t.Fatalf("expected configuration error: %v", err)
	}
}
func TestInvalidPortAndRootRejected(t *testing.T) {
	for _, env := range []map[string]string{{"MYSQL_DSN": "x", "GATEWAY_ADDR": "invalid"}, {"MYSQL_DSN": "x", "APP_DATA_DIR": "/"}} {
		if _, err := Load(env, t.TempDir()); err == nil {
			t.Fatal("unsafe config accepted")
		}
	}
}

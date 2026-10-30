package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadLocalEnvPreservesDSNEquals(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env.local")
	os.WriteFile(path, []byte("# comment\nMYSQL_DSN=user:secret@tcp(localhost:3306)/db?parseTime=true\nAPP_DATA_DIR=./var/data\n"), 0600)
	env, err := ReadEnv(path)
	if err != nil {
		t.Fatal(err)
	}
	if env["MYSQL_DSN"] != "user:secret@tcp(localhost:3306)/db?parseTime=true" {
		t.Fatal("DSN changed")
	}
}

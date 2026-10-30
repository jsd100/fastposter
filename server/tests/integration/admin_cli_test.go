package integration_test

import (
	"context"
	"fastposter/server/internal/testutil"
	"github.com/go-sql-driver/mysql"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestAuthAdminCLIReadsPasswordFromStdin(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	var database string
	if e := db.QueryRow("SELECT DATABASE()").Scan(&database); e != nil {
		t.Fatal(e)
	}
	cfg, e := mysql.ParseDSN(os.Getenv("FASTPOSTER_TEST_MYSQL_DSN"))
	if e != nil {
		t.Fatal("invalid test config")
	}
	cfg.DBName = database
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "go", "run", "./server/cmd/admin-cli", "-username", "cli-admin", "-password-stdin")
	cmd.Dir = repoRoot(t)
	cmd.Env = append(os.Environ(), "MYSQL_DSN="+cfg.FormatDSN())
	cmd.Stdin = strings.NewReader("administrator password from stdin\n")
	output, e := cmd.CombinedOutput()
	if e != nil {
		t.Fatalf("admin initialization failed: %s", output)
	}
	if strings.Contains(string(output), "administrator password from stdin") {
		t.Fatal("password leaked into output")
	}
	var role, hash string
	if e = db.QueryRow("SELECT role,password_hash FROM users WHERE username_normalized='cli-admin'").Scan(&role, &hash); e != nil || role != "admin" || !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatal("CLI did not create an administrator with a password hash")
	}
}

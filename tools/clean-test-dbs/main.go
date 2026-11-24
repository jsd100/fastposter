package main

// Command clean-test-dbs removes fastposter_test_<16 hex> databases leaked by
// interrupted integration tests. It is dry-run by default and only touches names
// that match the exact naming rule used by server/internal/testutil.
import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"fastposter/internal/config"
	"github.com/go-sql-driver/mysql"
)

const (
	// generatedPattern matches the random name produced by testutil.MySQL: 8 random bytes in lowercase hex.
	generatedPattern = `^fastposter_test_[0-9a-f]{16}$`
	// fixedTestDB is derived by tools/test-integration.py and must survive every cleanup.
	fixedTestDB = "fastposter_test_integration"
)

var generatedName = regexp.MustCompile(generatedPattern)

// Database is one fastposter_test_* schema found on the server.
type Database struct {
	Name     string
	Tables   int
	Bytes    int64
	Age      time.Duration
	AgeKnown bool
}

// IsGeneratedTestDB reports whether name follows the random naming used by testutil.MySQL.
func IsGeneratedTestDB(name string) bool { return generatedName.MatchString(name) }

// ActivityAge keeps the age of the most recent activity reported by information_schema.
// Missing timestamps stay unknown so callers can refuse to drop a schema of unknown age.
func ActivityAge(created, updated sql.NullInt64) (time.Duration, bool) {
	best := int64(-1)
	for _, v := range []sql.NullInt64{created, updated} {
		if v.Valid && v.Int64 >= 0 && (best < 0 || v.Int64 < best) {
			best = v.Int64
		}
	}
	if best < 0 {
		return 0, false
	}
	return time.Duration(best) * time.Second, true
}

// Eligibility decides whether a schema may be dropped during this run.
func Eligibility(name string, age time.Duration, known bool, minAge time.Duration, keep map[string]bool) (bool, string) {
	if keep[name] {
		return false, "whitelisted"
	}
	if !IsGeneratedTestDB(name) {
		return false, "does not match the generated name pattern"
	}
	if !known {
		return false, "age unknown"
	}
	if age < minAge {
		return false, "younger than " + minAge.String()
	}
	return true, ""
}

// pickDSN resolves the connection string and reports where it came from.
func pickDSN(flagValue string, env map[string]string) (string, string, error) {
	if v := strings.TrimSpace(flagValue); v != "" {
		return v, "-dsn", nil
	}
	if v := strings.TrimSpace(env["FASTPOSTER_TEST_MYSQL_DSN"]); v != "" {
		return v, "FASTPOSTER_TEST_MYSQL_DSN", nil
	}
	if v := strings.TrimSpace(env["MYSQL_DSN"]); v != "" {
		return v, "MYSQL_DSN", nil
	}
	return "", "", errors.New("no MySQL DSN: set MYSQL_DSN in .env.local, FASTPOSTER_TEST_MYSQL_DSN, or pass -dsn")
}

// endpoint renders a DSN target without credentials so output stays safe to paste.
func endpoint(dsn string) string {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return "MySQL"
	}
	if cfg.User == "" {
		return cfg.Addr
	}
	return cfg.User + "@" + cfg.Addr
}

func loadEnv() (map[string]string, error) {
	root, err := config.Root()
	if err != nil {
		return nil, err
	}
	env, err := config.ReadEnv(filepath.Join(root, ".env.local"))
	if err != nil {
		return nil, err
	}
	for k, v := range config.Environment() {
		env[k] = v
	}
	return env, nil
}

func listDatabases(ctx context.Context, db *sql.DB) ([]Database, error) {
	const query = `SELECT s.schema_name,
       COUNT(t.table_name),
       CAST(COALESCE(SUM(t.data_length + t.index_length), 0) AS SIGNED),
       TIMESTAMPDIFF(SECOND, MIN(t.create_time), NOW()),
       TIMESTAMPDIFF(SECOND, MAX(t.update_time), NOW())
FROM information_schema.schemata s
LEFT JOIN information_schema.tables t ON t.table_schema = s.schema_name
WHERE s.schema_name LIKE 'fastposter\_test\_%'
GROUP BY s.schema_name
ORDER BY s.schema_name`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Database
	for rows.Next() {
		var item Database
		var created, updated sql.NullInt64
		if err = rows.Scan(&item.Name, &item.Tables, &item.Bytes, &created, &updated); err != nil {
			return nil, err
		}
		item.Age, item.AgeKnown = ActivityAge(created, updated)
		out = append(out, item)
	}
	return out, rows.Err()
}

func dataDir(ctx context.Context, db *sql.DB) string {
	var dir string
	if err := db.QueryRowContext(ctx, "SELECT @@datadir").Scan(&dir); err != nil {
		return ""
	}
	return dir
}

// dirAge falls back to the schema directory mtime for schemas without tables.
func dirAge(dir, name string, now time.Time) (time.Duration, bool) {
	if dir == "" {
		return 0, false
	}
	info, err := os.Stat(filepath.Join(dir, name))
	if err != nil {
		return 0, false
	}
	age := now.Sub(info.ModTime())
	if age < 0 {
		age = 0
	}
	return age, true
}

func dropDatabase(ctx context.Context, db *sql.DB, name string) error {
	if !IsGeneratedTestDB(name) || name == fixedTestDB {
		return errors.New("refusing to drop a database outside the generated name pattern")
	}
	_, err := db.ExecContext(ctx, "DROP DATABASE IF EXISTS `"+name+"`")
	return err
}

func formatBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	value := float64(n)
	for _, suffix := range []string{"KB", "MB", "GB"} {
		value /= unit
		if value < unit {
			return fmt.Sprintf("%.1f %s", value, suffix)
		}
	}
	return fmt.Sprintf("%.1f TB", value/unit)
}

func formatAge(age time.Duration, known bool) string {
	if !known {
		return "unknown"
	}
	if age < time.Minute {
		return "just now"
	}
	if age < time.Hour {
		return fmt.Sprintf("%dm", int(age.Minutes()))
	}
	if age < 24*time.Hour {
		return fmt.Sprintf("%dh%02dm", int(age.Hours()), int(age.Minutes())%60)
	}
	return fmt.Sprintf("%dd%02dh", int(age.Hours())/24, int(age.Hours())%24)
}

func run(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("clean-test-dbs", flag.ContinueOnError)
	flags.SetOutput(out)
	apply := flags.Bool("apply", false, "drop matching databases; without it the run only reports")
	minAge := flags.Duration("min-age", 24*time.Hour, "only drop schemas idle for at least this long")
	keep := flags.String("keep", "", "extra database names to preserve, comma separated")
	dsnFlag := flags.String("dsn", "", "MySQL DSN override (default: FASTPOSTER_TEST_MYSQL_DSN, then MYSQL_DSN)")
	flags.Usage = func() {
		fmt.Fprintln(out, "usage: clean-test-dbs [-apply] [-min-age 24h] [-keep name,...] [-dsn dsn]")
		fmt.Fprintln(out, "removes leaked fastposter_test_<16 hex> databases; fixed test databases are always preserved")
		flags.PrintDefaults()
	}
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *minAge < 0 {
		return errors.New("-min-age cannot be negative")
	}

	env, err := loadEnv()
	if err != nil {
		return err
	}
	rawDSN, source, err := pickDSN(*dsnFlag, env)
	if err != nil {
		return err
	}
	cfg, err := mysql.ParseDSN(rawDSN)
	if err != nil {
		return errors.New("invalid MySQL DSN (details withheld)")
	}
	keepSet := map[string]bool{fixedTestDB: true}
	for _, name := range strings.Split(*keep, ",") {
		if name = strings.TrimSpace(name); name != "" {
			keepSet[name] = true
		}
	}
	if cfg.DBName != "" {
		keepSet[cfg.DBName] = true
	}
	adminDSN := cfg.Clone()
	adminDSN.DBName = ""
	if adminDSN.Timeout == 0 {
		adminDSN.Timeout = 10 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	db, err := sql.Open("mysql", adminDSN.FormatDSN())
	if err != nil {
		return errors.New("could not initialize MySQL client (details withheld)")
	}
	defer db.Close()
	if err = db.PingContext(ctx); err != nil {
		return errors.New("MySQL connection failed; check .env.local (credentials withheld)")
	}

	found, err := listDatabases(ctx, db)
	if err != nil {
		return fmt.Errorf("could not list databases: %w", err)
	}
	dir := dataDir(ctx, db)
	now := time.Now()
	var candidates, kept []Database
	var skipped []string
	var matchedBytes int64
	var matchedTables int
	for _, item := range found {
		if !item.AgeKnown {
			if age, ok := dirAge(dir, item.Name, now); ok {
				item.Age, item.AgeKnown = age, true
			}
		}
		matchedBytes += item.Bytes
		matchedTables += item.Tables
		allowed, reason := Eligibility(item.Name, item.Age, item.AgeKnown, *minAge, keepSet)
		switch {
		case allowed:
			candidates = append(candidates, item)
		case reason == "whitelisted":
			kept = append(kept, item)
		case reason == "does not match the generated name pattern":
			skipped = append(skipped, fmt.Sprintf("%s (%s; remove manually if unneeded)", item.Name, reason))
		default:
			skipped = append(skipped, fmt.Sprintf("%s (%s)", item.Name, reason))
		}
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].Age > candidates[j].Age })
	var candidateBytes int64
	for _, item := range candidates {
		candidateBytes += item.Bytes
	}

	mode := "dry-run"
	if *apply {
		mode = "apply"
	}
	fmt.Fprintf(out, "MySQL %s (source %s) | rule fastposter_test_<16 hex> | min age %s | %s\n", endpoint(rawDSN), source, minAge.String(), mode)
	fmt.Fprintf(out, "matched %d schemas, %d tables, %s: %d eligible (%s), %d kept, %d skipped\n", len(found), matchedTables, formatBytes(matchedBytes), len(candidates), formatBytes(candidateBytes), len(kept), len(skipped))
	for _, item := range candidates {
		fmt.Fprintf(out, "  %-34s %2d tables, %8s, idle %s\n", item.Name, item.Tables, formatBytes(item.Bytes), formatAge(item.Age, item.AgeKnown))
	}
	for _, line := range skipped {
		fmt.Fprintf(out, "  skipped %s\n", line)
	}
	for _, item := range kept {
		note := "whitelisted"
		if item.Name == fixedTestDB {
			note = "fixed database used by tools/test-integration.py"
		}
		fmt.Fprintf(out, "  kept %s (%s)\n", item.Name, note)
	}

	if len(candidates) == 0 {
		fmt.Fprintln(out, "nothing to do")
		return nil
	}
	if !*apply {
		fmt.Fprintf(out, "dry run: nothing deleted; re-run with -apply to drop %d schemas (%s)\n", len(candidates), formatBytes(candidateBytes))
		return nil
	}

	var dropped, failed int
	var freed int64
	for _, item := range candidates {
		if err := dropDatabase(ctx, db, item.Name); err != nil {
			failed++
			fmt.Fprintf(out, "  failed %s: %v\n", item.Name, err)
			continue
		}
		dropped++
		freed += item.Bytes
	}
	fmt.Fprintf(out, "dropped %d schemas, freed %s, %d failed\n", dropped, formatBytes(freed), failed)
	if failed > 0 {
		return fmt.Errorf("%d schemas could not be dropped", failed)
	}
	return nil
}

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

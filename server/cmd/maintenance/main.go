package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fastposter/internal/config"
	"fastposter/server/internal/app"
	"fastposter/server/internal/storage"
	"flag"
	"fmt"
	"github.com/go-sql-driver/mysql"
	"io"
	"io/fs"
	"log"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

const requiredSchemaVersion = 1
const backupFormat = "fastposter-backup"
const backupVersion = 1

var appTables = []string{
	"_schema_migrations", "users", "sessions", "password_reset_tokens", "projects", "project_revisions",
	"assets", "asset_versions", "asset_refs", "resources", "resource_versions", "staged_uploads",
	"export_jobs", "admin_audit_logs",
}
var databaseNamePattern = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

type backupManifest struct {
	Format        string           `json:"format"`
	Version       int              `json:"version"`
	CreatedAt     time.Time        `json:"createdAt"`
	SchemaVersion int              `json:"schemaVersion"`
	Database      string           `json:"database"`
	MySQLFile     string           `json:"mysqlFile"`
	MySQLSize     int64            `json:"mysqlSize"`
	MySQLSHA256   string           `json:"mysqlSha256"`
	DataFiles     int              `json:"dataFiles"`
	DataBytes     int64            `json:"dataBytes"`
	Counts        map[string]int64 `json:"counts"`
}

type backupReport struct {
	Backup        string           `json:"backup"`
	CreatedAt     time.Time        `json:"createdAt"`
	Database      string           `json:"database"`
	SchemaVersion int              `json:"schemaVersion"`
	MySQLSize     int64            `json:"mysqlSize"`
	DataFiles     int              `json:"dataFiles"`
	DataBytes     int64            `json:"dataBytes"`
	Counts        map[string]int64 `json:"counts"`
}

type restoreReport struct {
	Source        string           `json:"source"`
	Database      string           `json:"database"`
	DataDir       string           `json:"dataDir"`
	SchemaVersion int              `json:"schemaVersion"`
	DataFiles     int              `json:"dataFiles"`
	DataBytes     int64            `json:"dataBytes"`
	UniqueFiles   int              `json:"uniqueFiles"`
	Counts        map[string]int64 `json:"counts"`
}

type checkReport struct {
	Healthy           bool               `json:"healthy"`
	SchemaVersion     int                `json:"schemaVersion"`
	RequiredSchema    int                `json:"requiredSchema"`
	DataDir           string             `json:"dataDir"`
	Disk              storage.DiskHealth `json:"disk"`
	UsageBytes        int64              `json:"usageBytes"`
	MinFreeBytes      uint64             `json:"minFreeBytes"`
	MaintenanceActive bool               `json:"maintenanceActive"`
	Files             storage.FileCheck  `json:"files"`
	GC                storage.GCReport   `json:"gc"`
	RunningExports    int                `json:"runningExports"`
	ActiveUploads     int                `json:"activeUploads"`
	Counts            map[string]int64   `json:"counts"`
}

type gcReport struct {
	storage.GCReport
	DataDir string `json:"dataDir"`
}

func main() {
	log.SetFlags(0)
	log.SetPrefix("maintenance: ")
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	command := "check"
	args := os.Args[1:]
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		command = args[0]
		args = args[1:]
	}
	var e error
	switch command {
	case "check":
		e = runCheck(ctx, args)
	case "gc":
		e = runGC(ctx, args)
	case "backup":
		e = runBackup(ctx, args)
	case "restore":
		e = runRestore(ctx, args)
	case "help":
		usage()
		return
	default:
		usage()
		os.Exit(2)
	}
	if e != nil {
		log.Print(e)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `usage: maintenance [check|gc|backup|restore] [flags]

  check     database, files, disk and GC dry-run report (default; never deletes)
  gc        collect expired and unreferenced files; pass -apply to delete
  backup    pause writes, wait for in-flight work, dump MySQL and APP_DATA_DIR
  restore   import a backup into an independent database and data directory

Run from the repository root; MySQL credentials remain in .env.local or the environment.
`)
}

func openSource(ctx context.Context) (config.Config, *mysql.Config, *sql.DB, error) {
	c, e := config.FromRoot()
	if e != nil {
		return config.Config{}, nil, nil, e
	}
	cfg, e := mysql.ParseDSN(c.MySQLDSN)
	if e != nil || cfg.DBName == "" {
		return config.Config{}, nil, nil, errors.New("MYSQL_DSN must include the FastPoster database name")
	}
	db, e := app.OpenMySQL(ctx, c.MySQLDSN)
	if e != nil {
		return config.Config{}, nil, nil, e
	}
	return c, cfg, db, nil
}

func schemaVersion(ctx context.Context, db *sql.DB) (int, error) {
	var version int
	if e := db.QueryRowContext(ctx, "SELECT COALESCE(MAX(version),0) FROM _schema_migrations").Scan(&version); e != nil {
		return 0, errors.New("database schema is not ready; run the migration command first")
	}
	return version, nil
}

func tableCounts(ctx context.Context, db *sql.DB) (map[string]int64, error) {
	out := map[string]int64{}
	for _, table := range appTables {
		var count int64
		if e := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM `"+table+"`").Scan(&count); e != nil {
			return nil, e
		}
		out[table] = count
	}
	return out, nil
}

func printJSON(value any) error {
	raw, e := json.MarshalIndent(value, "", "  ")
	if e != nil {
		return e
	}
	fmt.Println(string(raw))
	return nil
}

func runCheck(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("check", flag.ContinueOnError)
	minFree := flags.Int64("min-free-mib", 512, "warn/fail below this free space in MiB")
	grace := flags.Duration("grace", storage.DefaultGCGrace, "orphan file grace period")
	verify := flags.Bool("verify-files", true, "read and hash referenced asset files")
	if e := flags.Parse(args); e != nil {
		return e
	}
	if *minFree < 0 {
		return errors.New("min-free-mib cannot be negative")
	}
	c, _, db, e := openSource(ctx)
	if e != nil {
		return e
	}
	defer db.Close()
	schema, e := schemaVersion(ctx, db)
	if e != nil {
		return e
	}
	health, e := storage.CheckHealth(ctx, c.AbsoluteDataDir)
	if e != nil {
		return fmt.Errorf("data directory check failed: %w", e)
	}
	store, e := storage.NewLocal(c.AbsoluteDataDir)
	if e != nil {
		return errors.New("local storage initialization failed")
	}
	defer store.Close()
	usage, e := storage.Usage(ctx, store)
	if e != nil {
		return e
	}
	files := storage.FileCheck{Missing: []string{}, Mismatched: []string{}}
	if *verify {
		if files, e = storage.VerifyFiles(ctx, db, store); e != nil {
			return e
		}
	}
	collector := storage.GC{DB: db, Store: store, Root: c.AbsoluteDataDir, Grace: *grace, DryRun: true}
	gc, e := collector.Run(ctx, time.Now().UTC())
	if e != nil {
		return e
	}
	counts, e := tableCounts(ctx, db)
	if e != nil {
		return e
	}
	report := checkReport{SchemaVersion: schema, RequiredSchema: requiredSchemaVersion, DataDir: c.AbsoluteDataDir, Disk: health, UsageBytes: usage, MinFreeBytes: uint64(*minFree) << 20, MaintenanceActive: storage.MaintenanceActive(c.AbsoluteDataDir), Files: files, GC: gc, Counts: counts}
	if e = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM export_jobs WHERE state='running' AND lease_until>UTC_TIMESTAMP(6)").Scan(&report.RunningExports); e != nil {
		return e
	}
	if e = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM staged_uploads WHERE state IN ('staged','claimed') AND expires_at>UTC_TIMESTAMP(6)").Scan(&report.ActiveUploads); e != nil {
		return e
	}
	report.Healthy = schema == requiredSchemaVersion && health.Writable && health.FreeBytes >= report.MinFreeBytes && files.Healthy()
	if e = printJSON(report); e != nil {
		return e
	}
	if !report.Healthy {
		return errors.New("health check failed; inspect the report above")
	}
	return nil
}

func runGC(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("gc", flag.ContinueOnError)
	apply := flags.Bool("apply", false, "delete expired and unreferenced files; default is dry-run")
	grace := flags.Duration("grace", storage.DefaultGCGrace, "orphan file grace period")
	if e := flags.Parse(args); e != nil {
		return e
	}
	c, _, db, e := openSource(ctx)
	if e != nil {
		return e
	}
	defer db.Close()
	store, e := storage.NewLocal(c.AbsoluteDataDir)
	if e != nil {
		return errors.New("local storage initialization failed")
	}
	defer store.Close()
	collector := storage.GC{DB: db, Store: store, Root: c.AbsoluteDataDir, Grace: *grace, DryRun: !*apply}
	report, e := collector.Run(ctx, time.Now().UTC())
	if e != nil {
		return e
	}
	return printJSON(gcReport{GCReport: report, DataDir: c.AbsoluteDataDir})
}

func runBackup(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("backup", flag.ContinueOnError)
	root, _ := config.Root()
	dest := flags.String("dest", filepath.Join(root, "var/backups/fastposter-"+time.Now().UTC().Format("20060102T150405Z")), "new directory for the backup; must be outside APP_DATA_DIR")
	wait := flags.Duration("wait", 3*time.Minute, "maximum time to wait for in-flight uploads and exports")
	quiesce := flags.Duration("quiesce", 5*time.Second, "delay after pausing new writes before dumping")
	dumpBin := flags.String("mysqldump", "mysqldump", "mysqldump binary")
	if e := flags.Parse(args); e != nil {
		return e
	}
	if *wait <= 0 || *quiesce < 0 {
		return errors.New("wait must be positive and quiesce cannot be negative")
	}
	c, cfg, db, e := openSource(ctx)
	if e != nil {
		return e
	}
	defer db.Close()
	schema, e := schemaVersion(ctx, db)
	if e != nil {
		return e
	}
	if schema != requiredSchemaVersion {
		return fmt.Errorf("database schema version %d is not supported by this binary", schema)
	}
	destAbs, e := filepath.Abs(*dest)
	if e != nil {
		return e
	}
	if within(c.AbsoluteDataDir, destAbs) {
		return errors.New("backup destination must be outside APP_DATA_DIR")
	}
	if _, e = os.Stat(destAbs); !errors.Is(e, os.ErrNotExist) {
		return fmt.Errorf("backup destination already exists: %s", destAbs)
	}
	partial := destAbs + ".partial"
	if _, e = os.Stat(partial); !errors.Is(e, os.ErrNotExist) {
		return fmt.Errorf("partial backup already exists, inspect or remove it first: %s", partial)
	}
	if e = os.MkdirAll(filepath.Dir(destAbs), 0700); e != nil {
		return e
	}
	if e = os.Mkdir(partial, 0700); e != nil {
		return e
	}
	keepPartial := true
	defer func() {
		if keepPartial {
			os.RemoveAll(partial)
		}
	}()
	guard, e := storage.BeginMaintenance(c.AbsoluteDataDir)
	if e != nil {
		return e
	}
	defer guard.Close()
	log.Print("application writes and export claims paused; waiting for in-flight work")
	if e = waitQuiescent(ctx, db, *wait, *quiesce); e != nil {
		return e
	}
	dumpPath := filepath.Join(partial, "mysql.sql")
	if e = dumpMySQL(ctx, cfg, dumpPath, *dumpBin); e != nil {
		return e
	}
	dumpSize, dumpHash, e := hashFile(dumpPath)
	if e != nil {
		return e
	}
	dataFiles, dataBytes, e := copyDataDir(ctx, c.AbsoluteDataDir, filepath.Join(partial, "data"))
	if e != nil {
		return e
	}
	counts, e := tableCounts(ctx, db)
	if e != nil {
		return e
	}
	created := time.Now().UTC()
	manifest := backupManifest{
		Format: backupFormat, Version: backupVersion, CreatedAt: created, SchemaVersion: schema,
		Database: cfg.DBName, MySQLFile: "mysql.sql", MySQLSize: dumpSize, MySQLSHA256: dumpHash,
		DataFiles: dataFiles, DataBytes: dataBytes, Counts: counts,
	}
	raw, e := json.MarshalIndent(manifest, "", "  ")
	if e != nil {
		return e
	}
	raw = append(raw, '\n')
	if e = os.WriteFile(filepath.Join(partial, "manifest.json"), raw, 0600); e != nil {
		return e
	}
	syncTree(partial)
	if e = os.Rename(partial, destAbs); e != nil {
		return e
	}
	keepPartial = false
	syncDir(filepath.Dir(destAbs))
	return printJSON(backupReport{Backup: destAbs, CreatedAt: created, Database: cfg.DBName, SchemaVersion: schema, MySQLSize: dumpSize, DataFiles: dataFiles, DataBytes: dataBytes, Counts: counts})
}

func waitQuiescent(ctx context.Context, db *sql.DB, wait, quiesce time.Duration) error {
	if e := sleepContext(ctx, quiesce); e != nil {
		return e
	}
	deadline := time.Now().Add(wait)
	for {
		var exports, uploads int
		if e := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM export_jobs WHERE state='running' AND lease_until>UTC_TIMESTAMP(6)").Scan(&exports); e != nil {
			return e
		}
		if e := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM staged_uploads WHERE state IN ('staged','claimed') AND expires_at>UTC_TIMESTAMP(6)").Scan(&uploads); e != nil {
			return e
		}
		if exports == 0 && uploads == 0 {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("timed out waiting for in-flight work: %d exports, %d uploads; retry after they finish or expire", exports, uploads)
		}
		if e := sleepContext(ctx, 500*time.Millisecond); e != nil {
			return e
		}
	}
}

func sleepContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func clientArgs(cfg *mysql.Config) []string {
	out := []string{}
	if cfg.Net == "unix" && cfg.Addr != "" {
		out = append(out, "--socket="+cfg.Addr)
	} else if cfg.Addr != "" {
		if host, port, e := net.SplitHostPort(cfg.Addr); e == nil {
			out = append(out, "--host="+host, "--port="+port, "--protocol=tcp")
		} else {
			out = append(out, "--host="+cfg.Addr)
		}
	}
	if cfg.User != "" {
		out = append(out, "--user="+cfg.User)
	}
	return out
}

type cappedBuffer struct {
	buf []byte
	max int
}

func (c *cappedBuffer) Write(p []byte) (int, error) {
	if len(c.buf) < c.max {
		n := len(p)
		if n > c.max-len(c.buf) {
			n = c.max - len(c.buf)
		}
		c.buf = append(c.buf, p[:n]...)
	}
	return len(p), nil
}

func (c *cappedBuffer) String() string { return strings.TrimSpace(string(c.buf)) }

func commandError(name string, err error, stderr *cappedBuffer, password string) error {
	message := stderr.String()
	if password != "" {
		message = strings.ReplaceAll(message, password, "***")
	}
	if message == "" {
		return fmt.Errorf("%s failed: %w", name, err)
	}
	return fmt.Errorf("%s failed: %w: %s", name, err, message)
}

func withPasswordEnv(password string) []string {
	out := make([]string, 0, len(os.Environ())+1)
	for _, item := range os.Environ() {
		if strings.HasPrefix(item, "MYSQL_PWD=") {
			continue
		}
		out = append(out, item)
	}
	return append(out, "MYSQL_PWD="+password)
}

func dumpMySQL(ctx context.Context, cfg *mysql.Config, path, binary string) error {
	if cfg.DBName == "" {
		return errors.New("source database name is missing")
	}
	if _, e := exec.LookPath(binary); e != nil {
		return fmt.Errorf("%s was not found in PATH", binary)
	}
	args := append(clientArgs(cfg),
		"--single-transaction", "--skip-lock-tables", "--no-tablespaces", "--triggers", "--routines",
		"--hex-blob", "--default-character-set=utf8mb4", "--set-gtid-purged=OFF", cfg.DBName)
	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Env = withPasswordEnv(cfg.Passwd)
	out, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	stderr := &cappedBuffer{max: 4096}
	cmd.Stdout = out
	cmd.Stderr = stderr
	runErr := cmd.Run()
	closeErr := out.Close()
	if runErr != nil {
		return commandError(binary, runErr, stderr, cfg.Passwd)
	}
	if closeErr != nil {
		return closeErr
	}
	info, e := os.Stat(path)
	if e != nil {
		return e
	}
	if info.Size() == 0 {
		return errors.New("mysqldump produced an empty file")
	}
	return nil
}

func hashFile(path string) (int64, string, error) {
	f, e := os.Open(path)
	if e != nil {
		return 0, "", e
	}
	defer f.Close()
	h := sha256.New()
	n, e := io.Copy(h, f)
	if e != nil {
		return 0, "", e
	}
	return n, hex.EncodeToString(h.Sum(nil)), nil
}

func copyDataDir(ctx context.Context, src, dst string) (int, int64, error) {
	files := 0
	var bytes int64
	if e := os.MkdirAll(dst, 0700); e != nil {
		return files, bytes, e
	}
	e := filepath.WalkDir(src, func(p string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if e := ctx.Err(); e != nil {
			return e
		}
		if p == src {
			return nil
		}
		rel, e := filepath.Rel(src, p)
		if e != nil {
			return e
		}
		key := filepath.ToSlash(rel)
		if entry.IsDir() {
			if key == ".work" || key == "tmp" {
				return fs.SkipDir
			}
			return os.MkdirAll(filepath.Join(dst, filepath.FromSlash(key)), 0700)
		}
		if strings.HasPrefix(entry.Name(), storage.MaintenanceGateName) {
			return nil
		}
		if entry.Type()&fs.ModeSymlink != 0 {
			return fmt.Errorf("refusing to back up symlink inside APP_DATA_DIR: %s", key)
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		info, e := entry.Info()
		if e != nil {
			return e
		}
		target := filepath.Join(dst, filepath.FromSlash(key))
		source, e := os.Open(p)
		if e != nil {
			return e
		}
		output, e := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if e != nil {
			source.Close()
			return e
		}
		_, copyErr := io.Copy(output, source)
		source.Close()
		syncErr := output.Sync()
		closeErr := output.Close()
		if copyErr != nil {
			return copyErr
		}
		if syncErr != nil {
			return syncErr
		}
		if closeErr != nil {
			return closeErr
		}
		if e = os.Chtimes(target, info.ModTime(), info.ModTime()); e != nil {
			return e
		}
		files++
		bytes += info.Size()
		return nil
	})
	if e != nil {
		return files, bytes, e
	}
	syncTree(dst)
	return files, bytes, nil
}

func syncTree(root string) {
	filepath.WalkDir(root, func(p string, entry fs.DirEntry, e error) error {
		if e != nil || entry == nil || !entry.IsDir() {
			return nil
		}
		syncDir(p)
		return nil
	})
}

func syncDir(dir string) {
	f, e := os.Open(dir)
	if e != nil {
		return
	}
	f.Sync()
	f.Close()
}

func within(parent, child string) bool {
	rel, e := filepath.Rel(parent, child)
	if e != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

func readManifest(source string) (backupManifest, error) {
	var manifest backupManifest
	raw, e := os.ReadFile(filepath.Join(source, "manifest.json"))
	if e != nil {
		return manifest, fmt.Errorf("backup manifest is missing: %w", e)
	}
	if e = json.Unmarshal(raw, &manifest); e != nil {
		return manifest, errors.New("backup manifest is invalid")
	}
	if manifest.Format != backupFormat || manifest.Version != backupVersion {
		return manifest, errors.New("unsupported backup format or version")
	}
	if manifest.MySQLFile != "mysql.sql" {
		return manifest, errors.New("backup manifest contains an unsafe MySQL file name")
	}
	if manifest.SchemaVersion != requiredSchemaVersion {
		return manifest, fmt.Errorf("backup schema version %d is not supported", manifest.SchemaVersion)
	}
	return manifest, nil
}

func runRestore(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("restore", flag.ContinueOnError)
	source := flags.String("source", "", "backup directory created by maintenance backup")
	dsn := flags.String("dsn", "", "target MySQL DSN; its database is imported into, other databases are never touched")
	dataDir := flags.String("data-dir", "", "target APP_DATA_DIR for restored files")
	mysqlBin := flags.String("mysql", "mysql", "mysql client binary used to import the dump")
	allowLive := flags.Bool("allow-live", false, "allow the target to match the configured live database or data directory")
	force := flags.Bool("force", false, "import over non-empty target tables or files (destructive)")
	verify := flags.Bool("verify-files", true, "read and hash referenced asset files after restore")
	if e := flags.Parse(args); e != nil {
		return e
	}
	if *source == "" || *dsn == "" || *dataDir == "" {
		flags.Usage()
		return errors.New("-source, -dsn and -data-dir are required for restore")
	}
	sourceAbs, e := filepath.Abs(*source)
	if e != nil {
		return e
	}
	manifest, e := readManifest(sourceAbs)
	if e != nil {
		return e
	}
	dumpPath := filepath.Join(sourceAbs, manifest.MySQLFile)
	dumpSize, dumpHash, e := hashFile(dumpPath)
	if e != nil {
		return fmt.Errorf("backup MySQL dump is missing: %w", e)
	}
	if dumpSize != manifest.MySQLSize || dumpHash != manifest.MySQLSHA256 {
		return errors.New("backup MySQL dump checksum does not match its manifest")
	}
	target, e := mysql.ParseDSN(*dsn)
	if e != nil {
		return errors.New("target DSN is invalid")
	}
	targetDB := target.DBName
	if !databaseNamePattern.MatchString(targetDB) {
		return errors.New("target DSN must include a simple database name using letters, digits or underscore")
	}
	switch targetDB {
	case "mysql", "information_schema", "performance_schema", "sys":
		return errors.New("target cannot be a MySQL system schema")
	}
	dataAbs, e := filepath.Abs(*dataDir)
	if e != nil {
		return e
	}
	if dataAbs == string(filepath.Separator) {
		return errors.New("target data directory cannot be the filesystem root")
	}
	if within(sourceAbs, dataAbs) || within(dataAbs, sourceAbs) {
		return errors.New("target data directory and backup directory must not contain each other")
	}
	if live, liveErr := config.FromRoot(); liveErr == nil {
		sameDB := func() bool {
			cfg, e := mysql.ParseDSN(live.MySQLDSN)
			return e == nil && cfg.DBName == targetDB
		}()
		if sameDB || live.AbsoluteDataDir == dataAbs {
			if !*allowLive {
				return errors.New("target matches the configured live database or data directory; stop the application and pass -allow-live after taking a safety copy")
			}
		}
	}
	adminConfig := *target
	adminConfig.DBName = ""
	admin, e := app.OpenMySQL(ctx, adminConfig.FormatDSN())
	if e != nil {
		return e
	}
	defer admin.Close()
	var exists int
	if e = admin.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?", targetDB).Scan(&exists); e != nil {
		return e
	}
	if exists == 0 {
		if _, e = admin.ExecContext(ctx, "CREATE DATABASE `"+targetDB+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); e != nil {
			return e
		}
	} else if !*force {
		var tables int
		if e = admin.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=?", targetDB).Scan(&tables); e != nil {
			return e
		}
		if tables > 0 {
			return fmt.Errorf("target database %s is not empty; pass -force only after taking a safety copy", targetDB)
		}
	}
	if info, e := os.Stat(dataAbs); e == nil {
		if !info.IsDir() {
			return errors.New("target data directory is not a directory")
		}
		if entries, e := os.ReadDir(dataAbs); e != nil {
			return e
		} else if len(entries) > 0 && !*force {
			return fmt.Errorf("target data directory %s is not empty; pass -force only after taking a safety copy", dataAbs)
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	}
	if e = os.MkdirAll(dataAbs, 0700); e != nil {
		return e
	}
	if _, e = exec.LookPath(*mysqlBin); e != nil {
		return fmt.Errorf("%s was not found in PATH", *mysqlBin)
	}
	importArgs := append(clientArgs(target), "--default-character-set=utf8mb4", "--database="+targetDB)
	command := exec.CommandContext(ctx, *mysqlBin, importArgs...)
	command.Env = withPasswordEnv(target.Passwd)
	dump, e := os.Open(dumpPath)
	if e != nil {
		return e
	}
	defer dump.Close()
	stderr := &cappedBuffer{max: 4096}
	command.Stdin = dump
	command.Stderr = stderr
	if e = command.Run(); e != nil {
		return commandError(*mysqlBin, e, stderr, target.Passwd)
	}
	dataFiles, dataBytes, e := copyDataDir(ctx, filepath.Join(sourceAbs, "data"), dataAbs)
	if e != nil {
		return e
	}
	if dataFiles != manifest.DataFiles || dataBytes != manifest.DataBytes {
		return fmt.Errorf("restored data file count or size does not match manifest: got %d files/%d bytes, want %d/%d", dataFiles, dataBytes, manifest.DataFiles, manifest.DataBytes)
	}
	restored, e := app.OpenMySQL(ctx, target.FormatDSN())
	if e != nil {
		return e
	}
	defer restored.Close()
	schema, e := schemaVersion(ctx, restored)
	if e != nil {
		return e
	}
	if schema != manifest.SchemaVersion {
		return fmt.Errorf("restored schema version %d does not match backup %d", schema, manifest.SchemaVersion)
	}
	counts, e := tableCounts(ctx, restored)
	if e != nil {
		return e
	}
	for _, table := range appTables {
		if counts[table] != manifest.Counts[table] {
			return fmt.Errorf("restored table %s has %d rows, backup had %d", table, counts[table], manifest.Counts[table])
		}
	}
	store, e := storage.NewLocal(dataAbs)
	if e != nil {
		return errors.New("restored data directory is not usable")
	}
	defer store.Close()
	report := restoreReport{Source: sourceAbs, Database: targetDB, DataDir: dataAbs, SchemaVersion: schema, DataFiles: dataFiles, DataBytes: dataBytes, Counts: counts}
	if *verify {
		check, e := storage.VerifyFiles(ctx, restored, store)
		if e != nil {
			return e
		}
		if !check.Healthy() {
			raw, _ := json.Marshal(check)
			return fmt.Errorf("restored files failed verification: %s", raw)
		}
		report.UniqueFiles = check.UniqueFiles
	}
	return printJSON(report)
}

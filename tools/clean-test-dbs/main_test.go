package main

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"
)

func TestIsGeneratedTestDB(t *testing.T) {
	cases := map[string]bool{
		"fastposter_test_0a2d01267b38d086":   true,
		"fastposter_test_ffffffffffffffff":   true,
		"fastposter_test_0a2d01267b38d08":    false,
		"fastposter_test_0a2d01267b38d0860":  false,
		"fastposter_test_0a2d01267b38d08g":   false,
		"fastposter_test_0A2D01267B38D086":   false,
		"fastposter_test_integration":        false,
		"fastposter_test_":                   false,
		"fastposter":                         false,
		"other_test_0a2d01267b38d086":        false,
		"fastposter_test_0a2d01267b38d086_x": false,
	}
	for name, want := range cases {
		if got := IsGeneratedTestDB(name); got != want {
			t.Errorf("IsGeneratedTestDB(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestActivityAgePrefersNewestSignal(t *testing.T) {
	cases := []struct {
		name         string
		created, upd sql.NullInt64
		wantAge      time.Duration
		wantKnown    bool
	}{
		{"both unknown", sql.NullInt64{}, sql.NullInt64{}, 0, false},
		{"created only", sql.NullInt64{Int64: 90, Valid: true}, sql.NullInt64{}, 90 * time.Second, true},
		{"updated newer", sql.NullInt64{Int64: 3600, Valid: true}, sql.NullInt64{Int64: 60, Valid: true}, time.Minute, true},
		{"created newer", sql.NullInt64{Int64: 30, Valid: true}, sql.NullInt64{Int64: 600, Valid: true}, 30 * time.Second, true},
		{"negative ignored", sql.NullInt64{Int64: -5, Valid: true}, sql.NullInt64{}, 0, false},
	}
	for _, c := range cases {
		age, known := ActivityAge(c.created, c.upd)
		if age != c.wantAge || known != c.wantKnown {
			t.Errorf("%s: got (%v, %v), want (%v, %v)", c.name, age, known, c.wantAge, c.wantKnown)
		}
	}
}

func TestEligibilityGuards(t *testing.T) {
	keep := map[string]bool{fixedTestDB: true}
	const day = 24 * time.Hour
	cases := []struct {
		name    string
		age     time.Duration
		known   bool
		minAge  time.Duration
		allowed bool
		reason  string
	}{
		{"fastposter_test_0a2d01267b38d086", 48 * time.Hour, true, day, true, ""},
		{"fastposter_test_0a2d01267b38d086", day, true, day, true, ""},
		{"fastposter_test_0a2d01267b38d086", day - time.Second, true, day, false, "younger than 24h0m0s"},
		{"fastposter_test_0a2d01267b38d086", 0, false, day, false, "age unknown"},
		{fixedTestDB, 90 * 24 * time.Hour, true, day, false, "whitelisted"},
		{"fastposter", 90 * 24 * time.Hour, true, day, false, "does not match the generated name pattern"},
		{"fastposter_test_0a2d01267b38d086", 48 * time.Hour, true, 0, true, ""},
	}
	for _, c := range cases {
		allowed, reason := Eligibility(c.name, c.age, c.known, c.minAge, keep)
		if allowed != c.allowed || reason != c.reason {
			t.Errorf("%s minAge=%s: got (%v, %q), want (%v, %q)", c.name, c.minAge, allowed, reason, c.allowed, c.reason)
		}
	}
}

func TestEligibilityHonoursExtraKeepList(t *testing.T) {
	keep := map[string]bool{fixedTestDB: true, "fastposter_test_0a2d01267b38d086": true}
	if allowed, reason := Eligibility("fastposter_test_0a2d01267b38d086", 48*time.Hour, true, time.Hour, keep); allowed || reason != "whitelisted" {
		t.Fatalf("extra keep entry was not honoured: %v %q", allowed, reason)
	}
}

func TestPickDSNPrecedence(t *testing.T) {
	env := map[string]string{
		"FASTPOSTER_TEST_MYSQL_DSN": "u:p@tcp(127.0.0.1:3306)/fastposter_test_integration",
		"MYSQL_DSN":                 "u:p@tcp(127.0.0.1:3306)/fastposter",
	}
	if dsn, source, err := pickDSN("", env); err != nil || source != "FASTPOSTER_TEST_MYSQL_DSN" || !strings.Contains(dsn, "fastposter_test_integration") {
		t.Fatalf("test DSN should win: %q %q %v", dsn, source, err)
	}
	if dsn, source, err := pickDSN("u:p@tcp(db:3306)/x", env); err != nil || source != "-dsn" || !strings.Contains(dsn, "/x") {
		t.Fatalf("flag should win: %q %q %v", dsn, source, err)
	}
	if _, source, err := pickDSN("", map[string]string{"MYSQL_DSN": "u:p@tcp(db:3306)/fastposter"}); err != nil || source != "MYSQL_DSN" {
		t.Fatalf("MYSQL_DSN fallback failed: %q %v", source, err)
	}
	if _, _, err := pickDSN("", map[string]string{}); err == nil {
		t.Fatal("missing DSN should fail")
	}
}

func TestEndpointNeverPrintsPassword(t *testing.T) {
	got := endpoint("poster:super-secret@tcp(127.0.0.1:3306)/fastposter?parseTime=true")
	if strings.Contains(got, "super-secret") {
		t.Fatalf("password leaked: %q", got)
	}
	if got != "poster@127.0.0.1:3306" {
		t.Fatalf("unexpected endpoint: %q", got)
	}
	if got := endpoint("not a dsn"); got != "MySQL" {
		t.Fatalf("invalid DSN should fall back to a generic label, got %q", got)
	}
}

func TestDropDatabaseRefusesForeignNames(t *testing.T) {
	for _, name := range []string{"fastposter", fixedTestDB, "mysql", "fastposter_test_0A2D01267B38D086"} {
		if err := dropDatabase(context.Background(), nil, name); err == nil {
			t.Fatalf("refused guard missing for %q", name)
		}
	}
}

func TestFormatBytes(t *testing.T) {
	cases := map[int64]string{0: "0 B", 512: "512 B", 1024: "1.0 KB", 1536: "1.5 KB", 5 << 20: "5.0 MB"}
	for in, want := range cases {
		if got := formatBytes(in); got != want {
			t.Errorf("formatBytes(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestFormatAge(t *testing.T) {
	cases := []struct {
		age   time.Duration
		known bool
		want  string
	}{
		{0, false, "unknown"},
		{30 * time.Second, true, "just now"},
		{5 * time.Minute, true, "5m"},
		{3*time.Hour + 7*time.Minute, true, "3h07m"},
		{50 * time.Hour, true, "2d02h"},
	}
	for _, c := range cases {
		if got := formatAge(c.age, c.known); got != c.want {
			t.Errorf("formatAge(%v, %v) = %q, want %q", c.age, c.known, got, c.want)
		}
	}
}

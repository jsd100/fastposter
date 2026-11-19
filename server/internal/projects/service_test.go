package projects

import (
	"errors"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"os"
	"testing"
)

func TestProjectTitleAndRevisionValidation(t *testing.T) {
	for _, title := range []string{"", "   ", string(make([]byte, 201))} {
		if _, e := validateTitle(title); e == nil {
			t.Fatal("invalid title accepted")
		}
	}
	for _, revision := range []string{"0", "-1", "1e3", "900719925474099312345", "01"} {
		if _, e := parseRevision(revision); e == nil {
			t.Fatal("invalid revision accepted", revision)
		}
	}
	if v, e := parseRevision("9007199254740993"); e != nil || v != 9007199254740993 {
		t.Fatal("revision lost precision")
	}
}

func TestGradientWriteBoundary(t *testing.T) {
	read := func(name string) document.Document {
		b, e := os.ReadFile("../../../tests/fixtures/documents/" + name + ".json")
		if e != nil {
			t.Fatal(e)
		}
		d, e := document.Parse(b)
		if e != nil {
			t.Fatal(e)
		}
		return d
	}
	code := func(e error) string {
		var known *domain.Error
		if !errors.As(e, &known) {
			t.Fatalf("not a domain error: %v", e)
		}
		return known.Code
	}

	v1Solid, v2Gradient := read("valid-mixed"), read("gradient-v2")
	if e := checkWrite(0, v1Solid); e != nil {
		t.Fatal("rejected v1 solid project", e)
	}
	if e := checkWrite(0, v2Gradient); e != nil {
		t.Fatal("rejected v2 gradient project with default configuration", e)
	}
	if e := checkWrite(1, v2Gradient); e != nil {
		t.Fatal("rejected v1 to v2 project upgrade", e)
	}
	if e := checkWrite(2, v1Solid); code(e) != "INVALID_INPUT" {
		t.Fatal("accepted a v2 to v1 project downgrade", e)
	}
}

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestContractGenSharesDTOsAndHTTPRoutes(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "test.thrift")
	source := `namespace go sample
enum State { DRAFT=0, READY=1 }
struct Request { 1: required string id (api.path="id"), 2: optional i32 page (api.query="page") }
struct Response { 1: required i64 revision, 2: optional State state, 3: required list<string> names }
service API { Response Get(1: Request request) (api.get="/api/v1/items/:id") }
`
	os.WriteFile(path, []byte(source), 0600)
	out, e := Generate([]string{path})
	if e != nil {
		t.Fatal(e)
	}
	for _, want := range []string{"revision: string", "state?: State", "names: string[]", "GET", "/api/v1/items/:id", "Route<Request, Response>"} {
		if !strings.Contains(out.TypeScript, want) {
			t.Errorf("missing %q", want)
		}
	}
	if len(out.Routes) != 1 || out.Routes[0].PathFields[0] != "id" || out.Routes[0].QueryFields[0] != "page" {
		t.Fatalf("incorrect routing bindings: %+v", out.Routes)
	}
}
func TestUnsupportedThriftTypeFails(t *testing.T) {
	path := filepath.Join(t.TempDir(), "unsupported.thrift")
	os.WriteFile(path, []byte(`struct Bad { 1: set<string> values }`), 0600)
	if _, e := Generate([]string{path}); e == nil {
		t.Fatal("set silently accepted")
	}
}

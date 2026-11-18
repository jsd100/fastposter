package exports

import (
	"encoding/json"
	"os"
	"testing"

	"fastposter/server/internal/document"
	"fastposter/server/internal/projects"
)

const rendererVersion = "poster-renderer-v1"

func TestQueuedSolidSnapshotStaysConsumable(t *testing.T) {
	raw, e := os.ReadFile("../../../tests/fixtures/exports/queued-solid-snapshot.json")
	if e != nil {
		t.Fatal(e)
	}
	var snapshot projects.RenderSnapshot
	if e = json.Unmarshal(raw, &snapshot); e != nil {
		t.Fatal("legacy queued snapshot cannot be read", e)
	}
	if snapshot.Document.SchemaVersion != 1 || snapshot.RendererVersion != rendererVersion {
		t.Fatalf("legacy snapshot changed on read: v%d %q", snapshot.Document.SchemaVersion, snapshot.RendererVersion)
	}
	if e = document.Validate(snapshot.Document); e != nil {
		t.Fatal("legacy snapshot document no longer validates", e)
	}
	// The read/export path never consults the gradient write switch, so this
	// snapshot can still be rendered after gradient writes are enabled.
	encoded, e := json.Marshal(snapshot)
	if e != nil {
		t.Fatal(e)
	}
	var roundTrip projects.RenderSnapshot
	if e = json.Unmarshal(encoded, &roundTrip); e != nil {
		t.Fatal(e)
	}
	if roundTrip.RendererVersion != rendererVersion || roundTrip.Document.SchemaVersion != 1 {
		t.Fatal("round trip changed the legacy snapshot")
	}
}

func TestV2GradientSnapshotUsesRendererVersionOne(t *testing.T) {
	raw, e := os.ReadFile("../../../tests/fixtures/documents/gradient-v2.json")
	if e != nil {
		t.Fatal(e)
	}
	d, e := document.Parse(raw)
	if e != nil {
		t.Fatal(e)
	}
	snapshot := projects.RenderSnapshot{Document: d, RendererVersion: rendererVersion}
	encoded, e := json.Marshal(snapshot)
	if e != nil {
		t.Fatal(e)
	}
	var decoded projects.RenderSnapshot
	if e = json.Unmarshal(encoded, &decoded); e != nil {
		t.Fatal("v2 snapshot cannot be read", e)
	}
	// The renderer protocol stays at v1: the schema version travels inside
	// the document, and the worker's version guard must keep accepting it.
	if decoded.RendererVersion != rendererVersion {
		t.Fatalf("renderer protocol changed: %q", decoded.RendererVersion)
	}
	if decoded.Document.SchemaVersion != 2 {
		t.Fatal("gradient document lost its schema version")
	}
	if e = document.Validate(decoded.Document); e != nil {
		t.Fatal("export worker would reject this snapshot", e)
	}
}

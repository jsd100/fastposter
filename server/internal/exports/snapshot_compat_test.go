package exports

import (
	"encoding/json"
	"os"
	"testing"

	"fastposter/server/internal/document"
	"fastposter/server/internal/projects"
)

func TestQueuedSolidSnapshotStaysConsumable(t *testing.T) {
	raw, e := os.ReadFile("../../../tests/fixtures/exports/queued-solid-snapshot.json")
	if e != nil {
		t.Fatal(e)
	}
	var snapshot projects.RenderSnapshot
	if e = json.Unmarshal(raw, &snapshot); e != nil {
		t.Fatal("legacy queued snapshot cannot be read", e)
	}
	if snapshot.Document.SchemaVersion != 1 || snapshot.RendererVersion != projects.SolidRendererVersion {
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
	if roundTrip.RendererVersion != projects.SolidRendererVersion || roundTrip.Document.SchemaVersion != 1 {
		t.Fatal("round trip changed the legacy snapshot")
	}
}

func TestV2GradientSnapshotPreservesBothRendererVersionLabels(t *testing.T) {
	raw, e := os.ReadFile("../../../tests/fixtures/documents/gradient-v2.json")
	if e != nil {
		t.Fatal(e)
	}
	d, e := document.Parse(raw)
	if e != nil {
		t.Fatal(e)
	}
	// Existing v2 snapshots can still carry the original renderer version.
	for _, version := range []string{projects.SolidRendererVersion, projects.GradientRendererVersion} {
		t.Run(version, func(t *testing.T) {
			snapshot := projects.RenderSnapshot{Document: d, RendererVersion: version}
			encoded, e := json.Marshal(snapshot)
			if e != nil {
				t.Fatal(e)
			}
			var decoded projects.RenderSnapshot
			if e = json.Unmarshal(encoded, &decoded); e != nil {
				t.Fatal("v2 snapshot cannot be read", e)
			}
			if decoded.RendererVersion != version || decoded.Document.SchemaVersion != 2 {
				t.Fatalf("snapshot versions changed: renderer=%q schema=%d", decoded.RendererVersion, decoded.Document.SchemaVersion)
			}
			if e = document.Validate(decoded.Document); e != nil {
				t.Fatal("export worker would reject this snapshot", e)
			}
		})
	}
}

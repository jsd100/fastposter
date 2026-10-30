package exports

import (
	"context"
	"fastposter/server/internal/projects"
	"testing"
)

func TestWorkerRejectsSnapshotWithoutResources(t *testing.T) {
	w := Worker{}
	if _, _, _, e := w.Render(context.Background(), projects.RenderSnapshot{}); e == nil {
		t.Fatal("missing snapshot rendered successfully")
	}
}

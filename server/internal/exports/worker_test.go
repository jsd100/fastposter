package exports

import (
	"context"
	"fastposter/server/internal/projects"
	"testing"
	"time"
)

func TestWorkerRejectsSnapshotWithoutResources(t *testing.T) {
	w := Worker{}
	if _, _, _, e := w.Render(context.Background(), projects.RenderSnapshot{}); e == nil {
		t.Fatal("missing snapshot rendered successfully")
	}
}

func TestWorkerDoesNotClaimWhileMaintenancePausesIt(t *testing.T) {
	w := Worker{Paused: func() bool { return true }}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if e := w.Run(ctx); e != nil {
		t.Fatal(e)
	}
}

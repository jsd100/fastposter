package transport

import (
	"context"
	"fastposter/server/gen/kitex/core"
	"testing"
)

func TestPingPreservesRequestID(t *testing.T) {
	r, e := (&CoreHandler{}).Ping(context.Background(), &core.PingRequest{RequestId: "check-1"})
	if e != nil || r.RequestId != "check-1" || r.Message != "pong" {
		t.Fatalf("unexpected health response: %+v %v", r, e)
	}
}

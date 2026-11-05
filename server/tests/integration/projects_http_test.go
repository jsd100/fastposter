package integration_test

import (
	"context"
	"encoding/json"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/projectdeletions"
	"fastposter/server/internal/transport"
	hserver "github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/kitex/client"
	kserver "github.com/cloudwego/kitex/server"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestProjectHTTPConflictAndPrivateList(t *testing.T) {
	svc, db, doc := projectService(t)
	ctx := context.Background()
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	user, e := accounts.Register(ctx, "http-owner", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE assets SET owner_id=? WHERE owner_id='u1'", user.ID); e != nil {
		t.Fatal(e)
	}
	session, e := accounts.Login(ctx, "http-owner", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	server := coreservice.NewServer(&transport.CoreHandler{ProjectsFunc: transport.ProjectsAdapter(accounts, svc, projectdeletions.NewService(db, svc.Store))}, kserver.WithListener(listener))
	go server.Run()
	defer server.Stop()
	rpc, e := coreservice.NewClient("projects.test", client.WithHostPorts(listener.Addr().String()), client.WithRPCTimeout(5*time.Second))
	if e != nil {
		t.Fatal(e)
	}
	hl, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	h := hserver.New(hserver.WithListener(hl))
	g := transport.Gateway{RPC: rpc, AllowedOrigins: []string{"http://poster.test"}}
	g.Register(h)
	go h.Run()
	defer h.Close()
	web := &http.Client{Timeout: 5 * time.Second}
	base := "http://" + hl.Addr().String()
	request := func(method, path string, body any) (int, []byte) {
		t.Helper()
		raw, _ := json.Marshal(body)
		req, e := http.NewRequest(method, base+path, strings.NewReader(string(raw)))
		if e != nil {
			t.Fatal(e)
		}
		req.AddCookie(&http.Cookie{Name: "fp_session", Value: session.Token})
		req.Header.Set("Origin", "http://poster.test")
		req.Header.Set("Content-Type", "application/json")
		r, e := web.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		defer r.Body.Close()
		response, e := io.ReadAll(r.Body)
		if e != nil {
			t.Fatal(e)
		}
		return r.StatusCode, response
	}
	raw, _ := json.Marshal(doc)
	status, body := request("POST", "/api/v1/projects", map[string]string{"title": "作品", "document": string(raw)})
	if status != 200 {
		t.Fatalf("create %d %s", status, body)
	}
	var payload common.PublicPayload
	if e = json.Unmarshal(body, &payload); e != nil || payload.Project == nil {
		t.Fatal("missing project")
	}
	id := payload.Project.Id
	input := map[string]string{"title": "已保存", "document": string(raw), "expectedRevision": "1"}
	status, body = request("PUT", "/api/v1/projects/"+id, input)
	if status != 200 {
		t.Fatalf("save %d %s", status, body)
	}
	status, body = request("PUT", "/api/v1/projects/"+id, input)
	if status != 409 || !strings.Contains(string(body), "REVISION_CONFLICT") {
		t.Fatalf("stale response %d %s", status, body)
	}
	status, body = request("GET", "/api/v1/projects", nil)
	if status != 200 || strings.Contains(string(body), "owner_id") || !strings.Contains(string(body), "已保存") {
		t.Fatalf("list response %d %s", status, body)
	}
}

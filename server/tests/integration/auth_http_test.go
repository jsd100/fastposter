package integration_test

import (
	"bytes"
	"encoding/json"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/testutil"
	"fastposter/server/internal/transport"
	hserver "github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/kitex/client"
	kserver "github.com/cloudwego/kitex/server"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"testing"
	"time"
)

func TestAuthHTTPLoginCSRFAndLogout(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	service, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	rpcListener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	handler := &transport.CoreHandler{AuthFunc: transport.AuthAdapter(service)}
	rpcServer := coreservice.NewServer(handler, kserver.WithListener(rpcListener))
	go rpcServer.Run()
	defer rpcServer.Stop()
	rpc, e := coreservice.NewClient("test.core", client.WithHostPorts(rpcListener.Addr().String()), client.WithRPCTimeout(3*time.Second))
	if e != nil {
		t.Fatal(e)
	}
	httpListener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	h := hserver.New(hserver.WithListener(httpListener))
	gateway := transport.Gateway{RPC: rpc, AllowedOrigins: []string{"http://poster.test"}}
	gateway.Register(h)
	go h.Run()
	defer h.Close()
	base := "http://" + httpListener.Addr().String()
	jar, _ := cookiejar.New(nil)
	web := &http.Client{Jar: jar, Timeout: 5 * time.Second}
	request := func(path, origin, body string) *http.Response {
		t.Helper()
		r, e := http.NewRequest("POST", base+path, strings.NewReader(body))
		if e != nil {
			t.Fatal(e)
		}
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		response, e := web.Do(r)
		if e != nil {
			t.Fatal(e)
		}
		return response
	}
	bad := request("/api/v1/auth/register", "https://evil.example", `{"username":"poster-user","password":"correct horse battery"}`)
	bad.Body.Close()
	if bad.StatusCode != 403 {
		t.Fatalf("cross-origin request status %d", bad.StatusCode)
	}
	forged := request("/api/v1/auth/register", "http://poster.test", `{"username":"poster-user","password":"correct horse battery","role":"admin"}`)
	forged.Body.Close()
	if forged.StatusCode != 422 {
		t.Fatal("role could be chosen at registration")
	}
	created := request("/api/v1/auth/register", "http://poster.test", `{"username":"poster-user","password":"correct horse battery"}`)
	if created.StatusCode != 200 {
		body, _ := io.ReadAll(created.Body)
		t.Fatalf("register failed: %s", body)
	}
	created.Body.Close()
	login := request("/api/v1/auth/login", "http://poster.test", `{"username":"poster-user","password":"correct horse battery"}`)
	var payload map[string]any
	json.NewDecoder(login.Body).Decode(&payload)
	login.Body.Close()
	if login.StatusCode != 200 || bytes.Contains(mustJSON(payload), []byte("correct horse battery")) {
		t.Fatal("unsafe login response")
	}
	cookies := login.Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].Name != "fp_session" || cookies[0].SameSite != http.SameSiteLaxMode {
		t.Fatal("session cookie attributes incorrect")
	}
	me, e := web.Get(base + "/api/v1/auth/me")
	if e != nil {
		t.Fatal(e)
	}
	me.Body.Close()
	if me.StatusCode != 200 {
		t.Fatal("authenticated request rejected")
	}
	out := request("/api/v1/auth/logout", "http://poster.test", "{}")
	out.Body.Close()
	me, e = web.Get(base + "/api/v1/auth/me")
	if e != nil {
		t.Fatal(e)
	}
	me.Body.Close()
	if me.StatusCode != 401 {
		t.Fatal("logout did not invalidate session")
	}
	secureListener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	secureServer := hserver.New(hserver.WithListener(secureListener))
	secureGateway := transport.Gateway{RPC: rpc, AllowedOrigins: []string{"http://poster.test"}, SecureCookies: true}
	secureGateway.Register(secureServer)
	go secureServer.Run()
	defer secureServer.Close()
	secureRequest, e := http.NewRequest("POST", "http://"+secureListener.Addr().String()+"/api/v1/auth/login", strings.NewReader(`{"username":"poster-user","password":"correct horse battery"}`))
	if e != nil {
		t.Fatal(e)
	}
	secureRequest.Header.Set("Origin", "http://poster.test")
	secureRequest.Header.Set("Content-Type", "application/json")
	secure, e := web.Do(secureRequest)
	if e != nil {
		t.Fatal(e)
	}
	secure.Body.Close()
	if len(secure.Cookies()) != 1 || !secure.Cookies()[0].Secure {
		t.Fatal("production Secure flag missing")
	}
}
func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }

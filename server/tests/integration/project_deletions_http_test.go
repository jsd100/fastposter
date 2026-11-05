package integration_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/document"
	"fastposter/server/internal/projectdeletions"
	"fastposter/server/internal/storage"
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

type deletionDTOJSON struct {
	Id          string `json:"id"`
	ProjectId   string `json:"projectId"`
	OwnerId     string `json:"ownerId"`
	State       string `json:"state"`
	CreatedAt   string `json:"createdAt"`
	Title       string `json:"title"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	DeletedAt   string `json:"deletedAt"`
	CompletedAt string `json:"completedAt"`
	ErrorCode   string `json:"errorCode"`
}

type deletionEnvelope struct {
	RequestId string            `json:"requestId"`
	Deletion  *deletionDTOJSON  `json:"deletion"`
	Deletions []deletionDTOJSON `json:"deletions"`
	Total     int               `json:"total"`
	Code      string            `json:"code"`
	Message   string            `json:"message"`
}

type deletionHTTP struct {
	t      *testing.T
	db     *sql.DB
	doc    document.Document
	store  storage.FileStore
	base   string
	web    *http.Client
	owner  auth.SessionToken
	other  auth.SessionToken
	admin  auth.SessionToken
	locked auth.SessionToken
}

func newDeletionHTTP(t *testing.T) *deletionHTTP {
	t.Helper()
	svc, db, doc := projectService(t)
	ctx := context.Background()
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	owner, e := accounts.Register(ctx, "deletion-owner", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = accounts.Register(ctx, "deletion-other", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	if _, e = accounts.Register(ctx, "deletion-locked", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	if _, e = accounts.CreateAdmin(ctx, "deletion-admin", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE assets SET owner_id=? WHERE owner_id='u1'", owner.ID); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE users SET must_change_password=1 WHERE username_normalized='deletion-locked'"); e != nil {
		t.Fatal(e)
	}
	login := func(name string) auth.SessionToken {
		token, e := accounts.Login(ctx, name, "correct horse battery")
		if e != nil {
			t.Fatal(e)
		}
		return token
	}
	h := &deletionHTTP{t: t, db: db, doc: doc, store: svc.Store}
	h.owner, h.other, h.admin, h.locked = login("deletion-owner"), login("deletion-other"), login("deletion-admin"), login("deletion-locked")
	deletions := projectdeletions.NewService(db, svc.Store)
	library := catalog.NewService(db, svc.Store, assets.NewService(db, svc.Store, nil, t.TempDir()))
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	server := coreservice.NewServer(&transport.CoreHandler{ProjectsFunc: transport.ProjectsAdapter(accounts, svc, deletions), AdminFunc: transport.AdminAdapter(accounts, library, deletions)}, kserver.WithListener(listener))
	go server.Run()
	t.Cleanup(func() { server.Stop() })
	rpc, e := coreservice.NewClient("deletions.test", client.WithHostPorts(listener.Addr().String()), client.WithRPCTimeout(5*time.Second))
	if e != nil {
		t.Fatal(e)
	}
	hl, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	gateway := hserver.New(hserver.WithListener(hl))
	g := transport.Gateway{RPC: rpc, AllowedOrigins: []string{"http://poster.test"}}
	g.Register(gateway)
	go gateway.Run()
	t.Cleanup(func() { gateway.Close() })
	h.base = "http://" + hl.Addr().String()
	h.web = &http.Client{Timeout: 5 * time.Second}
	return h
}

func (h *deletionHTTP) do(method, path, token string, body any) (int, []byte) {
	h.t.Helper()
	var reader io.Reader
	if body != nil {
		raw, e := json.Marshal(body)
		if e != nil {
			h.t.Fatal(e)
		}
		reader = strings.NewReader(string(raw))
	}
	req, e := http.NewRequest(method, h.base+path, reader)
	if e != nil {
		h.t.Fatal(e)
	}
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "fp_session", Value: token})
	}
	req.Header.Set("Origin", "http://poster.test")
	req.Header.Set("Content-Type", "application/json")
	response, e := h.web.Do(req)
	if e != nil {
		h.t.Fatal(e)
	}
	defer response.Body.Close()
	raw, e := io.ReadAll(response.Body)
	if e != nil {
		h.t.Fatal(e)
	}
	return response.StatusCode, raw
}

func (h *deletionHTTP) createProject(title string) string {
	h.t.Helper()
	raw, _ := json.Marshal(h.doc)
	status, body := h.do("POST", "/api/v1/projects", h.owner.Token, map[string]string{"title": title, "document": string(raw)})
	if status != 200 {
		h.t.Fatalf("create %d %s", status, body)
	}
	var payload struct {
		Project *struct {
			Id string `json:"id"`
		} `json:"project"`
	}
	if e := json.Unmarshal(body, &payload); e != nil || payload.Project == nil {
		h.t.Fatalf("create payload %s", body)
	}
	return payload.Project.Id
}

func (h *deletionHTTP) trashProject(id string) {
	h.t.Helper()
	if status, body := h.do("DELETE", "/api/v1/projects/"+id, h.owner.Token, nil); status != 200 {
		h.t.Fatalf("soft delete %d %s", status, body)
	}
}

func (h *deletionHTTP) accept(id string) deletionDTOJSON {
	h.t.Helper()
	status, body := h.do("DELETE", "/api/v1/projects/"+id+"/permanent", h.owner.Token, nil)
	if status != 200 {
		h.t.Fatalf("permanent delete %d %s", status, body)
	}
	var reply deletionEnvelope
	if e := json.Unmarshal(body, &reply); e != nil || reply.Deletion == nil {
		h.t.Fatalf("permanent delete payload %s", body)
	}
	return *reply.Deletion
}

func decodeDeletion(t *testing.T, body []byte) deletionEnvelope {
	t.Helper()
	var reply deletionEnvelope
	if e := json.Unmarshal(body, &reply); e != nil {
		t.Fatalf("decode %s: %v", body, e)
	}
	return reply
}

func TestPermanentDeletionHTTPPermissionsAndReplay(t *testing.T) {
	h := newDeletionHTTP(t)
	first := h.createProject("彻底删除作品")
	h.trashProject(first)
	if status, body := h.do("DELETE", "/api/v1/projects/"+first+"/permanent", "", nil); status != 401 || !strings.Contains(string(body), "AUTH_REQUIRED") {
		t.Fatalf("anonymous delete %d %s", status, body)
	}
	if status, body := h.do("DELETE", "/api/v1/projects/"+first+"/permanent", h.locked.Token, nil); status != 403 || !strings.Contains(string(body), "PASSWORD_CHANGE_REQUIRED") {
		t.Fatalf("locked account delete %d %s", status, body)
	}
	if status, body := h.do("DELETE", "/api/v1/projects/"+first+"/permanent", h.other.Token, nil); status != 404 {
		t.Fatalf("cross-user delete %d %s", status, body)
	}
	if status, body := h.do("DELETE", "/api/v1/admin/projects/"+first+"/permanent", h.owner.Token, nil); status != 403 {
		t.Fatalf("user forged admin delete %d %s", status, body)
	}
	task := h.accept(first)
	if task.State != "pending" || task.ProjectId != first || task.OwnerId == "" || task.Title != "彻底删除作品" || task.Width != 1200 || task.Height != 1600 {
		t.Fatalf("unexpected deletion task %+v", task)
	}
	replay := h.accept(first)
	if replay.Id != task.Id {
		t.Fatalf("replay created a second task: %s vs %s", replay.Id, task.Id)
	}
	var tasks int
	if e := h.db.QueryRow("SELECT COUNT(*) FROM project_deletions WHERE project_id=?", first).Scan(&tasks); e != nil || tasks != 1 {
		t.Fatalf("replay task count %d %v", tasks, e)
	}
	status, body := h.do("GET", "/api/v1/project-deletions", h.owner.Token, nil)
	if status != 200 {
		t.Fatalf("list %d %s", status, body)
	}
	if strings.Contains(string(body), "document") || strings.Contains(string(body), "original_key") || strings.Contains(string(body), "snapshot") || strings.Contains(string(body), "internal_error") {
		t.Fatalf("list leaked private payload %s", body)
	}
	list := decodeDeletion(t, body)
	if list.Total != 1 || len(list.Deletions) != 1 || list.Deletions[0].Id != task.Id {
		t.Fatalf("unexpected deletion list %+v", list)
	}
	if status, body = h.do("GET", "/api/v1/project-deletions", h.other.Token, nil); status != 200 || decodeDeletion(t, body).Total != 0 {
		t.Fatalf("other user list %d %s", status, body)
	}
	if status, body = h.do("GET", "/api/v1/project-deletions/"+task.Id, h.other.Token, nil); status != 404 {
		t.Fatalf("other user detail %d %s", status, body)
	}
	if status, body = h.do("POST", "/api/v1/project-deletions/"+task.Id+"/retry", h.other.Token, nil); status != 404 {
		t.Fatalf("other user retry %d %s", status, body)
	}
	second := h.createProject("管理员删除作品")
	h.trashProject(second)
	status, body = h.do("DELETE", "/api/v1/admin/projects/"+second+"/permanent", h.admin.Token, nil)
	if status != 200 {
		t.Fatalf("admin delete %d %s", status, body)
	}
	adminTask := decodeDeletion(t, body).Deletion
	if adminTask == nil || adminTask.ProjectId != second || adminTask.OwnerId == "" {
		t.Fatalf("admin task %s", body)
	}
	status, body = h.do("GET", "/api/v1/admin/project-deletions", h.admin.Token, nil)
	if status != 200 {
		t.Fatalf("admin list %d %s", status, body)
	}
	adminList := decodeDeletion(t, body)
	if adminList.Total != 2 || len(adminList.Deletions) != 2 {
		t.Fatalf("unexpected admin list %+v", adminList)
	}
	if status, body = h.do("GET", "/api/v1/admin/project-deletions/"+adminTask.Id, h.admin.Token, nil); status != 200 {
		t.Fatalf("admin detail %d %s", status, body)
	}
	if status, body = h.do("POST", "/api/v1/admin/project-deletions/"+adminTask.Id+"/retry", h.admin.Token, nil); status != 200 {
		t.Fatalf("admin retry %d %s", status, body)
	}
	var retries int
	if e := h.db.QueryRow("SELECT COUNT(*) FROM admin_audit_logs WHERE action='project.cleanup-retry' AND target_id=?", adminTask.Id).Scan(&retries); e != nil || retries != 1 {
		t.Fatalf("admin retry audit %d %v", retries, e)
	}
}

func TestDeletionHTTPStatusAndRetry(t *testing.T) {
	h := newDeletionHTTP(t)
	projectID := h.createProject("等待清理")
	h.trashProject(projectID)
	task := h.accept(projectID)
	if _, e := h.db.Exec("UPDATE project_deletions SET state='retry_wait',safe_error_code='CLEANUP_FAILED',internal_error='disk full',attempts=1,next_attempt_at=UTC_TIMESTAMP(6)+INTERVAL 1 HOUR WHERE id=?", task.Id); e != nil {
		t.Fatal(e)
	}
	status, body := h.do("GET", "/api/v1/project-deletions", h.owner.Token, nil)
	if status != 200 {
		t.Fatalf("list %d %s", status, body)
	}
	list := decodeDeletion(t, body)
	if list.Total != 1 || len(list.Deletions) != 1 || list.Deletions[0].State != "retry_wait" || list.Deletions[0].ErrorCode != "CLEANUP_FAILED" {
		t.Fatalf("unexpected retry list %+v", list)
	}
	if strings.Contains(string(body), "disk full") || strings.Contains(string(body), "original_key") || strings.Contains(string(body), "document") {
		t.Fatalf("retry list leaked internals %s", body)
	}
	status, body = h.do("GET", "/api/v1/project-deletions/"+task.Id, h.owner.Token, nil)
	if status != 200 || decodeDeletion(t, body).Deletion.State != "retry_wait" {
		t.Fatalf("detail %d %s", status, body)
	}
	status, body = h.do("POST", "/api/v1/project-deletions/"+task.Id+"/retry", h.owner.Token, nil)
	if status != 200 || decodeDeletion(t, body).Deletion.State != "retry_wait" {
		t.Fatalf("retry %d %s", status, body)
	}
	var wait float64
	if e := h.db.QueryRow("SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(6),next_attempt_at) FROM project_deletions WHERE id=?", task.Id).Scan(&wait); e != nil || wait > 5 {
		t.Fatalf("retry did not make the task due: %f %v", wait, e)
	}
	if _, e := h.db.Exec("UPDATE project_deletions SET state='completed',completed_at=UTC_TIMESTAMP(6),title=NULL,width=NULL,height=NULL,safe_error_code=NULL,internal_error=NULL WHERE id=?", task.Id); e != nil {
		t.Fatal(e)
	}
	status, body = h.do("GET", "/api/v1/project-deletions", h.owner.Token, nil)
	if status != 200 || decodeDeletion(t, body).Total != 0 {
		t.Fatalf("completed task stayed in the unfinished list %d %s", status, body)
	}
	status, body = h.do("GET", "/api/v1/project-deletions/"+task.Id, h.owner.Token, nil)
	if status != 200 || decodeDeletion(t, body).Deletion.State != "completed" {
		t.Fatalf("completed detail %d %s", status, body)
	}
	if status, body = h.do("GET", "/api/v1/project-deletions/"+task.Id, h.other.Token, nil); status != 404 {
		t.Fatalf("other user read completed detail %d %s", status, body)
	}
	active := h.createProject("正常作品")
	status, body = h.do("DELETE", "/api/v1/projects/"+active+"/permanent", h.owner.Token, nil)
	if status != 409 || !strings.Contains(string(body), "CONFLICT") {
		t.Fatalf("active project delete %d %s", status, body)
	}
}

func TestAdminProjectsStatusFilter(t *testing.T) {
	h := newDeletionHTTP(t)
	normal := h.createProject("正常作品")
	trashed := h.createProject("回收站作品")
	h.trashProject(trashed)
	type adminProjectsJSON struct {
		Projects []struct {
			Id        string `json:"id"`
			DeletedAt string `json:"deletedAt"`
		} `json:"projects"`
		Total int `json:"total"`
	}
	decode := func(body []byte) adminProjectsJSON {
		var parsed adminProjectsJSON
		if e := json.Unmarshal(body, &parsed); e != nil {
			t.Fatalf("decode %s: %v", body, e)
		}
		return parsed
	}
	status, body := h.do("GET", "/api/v1/admin/projects", h.admin.Token, nil)
	if status != 200 {
		t.Fatalf("admin projects %d %s", status, body)
	}
	if all := decode(body); all.Total != 2 {
		t.Fatalf("default admin projects %s", body)
	}
	read := func(query string) (int, []byte) {
		return h.do("GET", "/api/v1/admin/projects?"+query, h.admin.Token, nil)
	}
	status, body = read("status=normal")
	if status != 200 {
		t.Fatalf("normal %d %s", status, body)
	}
	normalList := decode(body)
	if normalList.Total != 1 || len(normalList.Projects) != 1 || normalList.Projects[0].Id != normal || normalList.Projects[0].DeletedAt != "" {
		t.Fatalf("normal filter %s", body)
	}
	status, body = read("status=trash")
	if status != 200 {
		t.Fatalf("trash %d %s", status, body)
	}
	trashList := decode(body)
	if trashList.Total != 1 || len(trashList.Projects) != 1 || trashList.Projects[0].Id != trashed || trashList.Projects[0].DeletedAt == "" {
		t.Fatalf("trash filter %s", body)
	}
	status, body = read("status=all")
	if status != 200 || decode(body).Total != 2 {
		t.Fatalf("all filter %d %s", status, body)
	}
	status, body = read("status=unknown")
	if status != 422 || !strings.Contains(string(body), "INVALID_INPUT") {
		t.Fatalf("unknown filter %d %s", status, body)
	}
	if status, body = h.do("GET", "/api/v1/admin/users?status=unknown", h.admin.Token, nil); status != 200 {
		t.Fatalf("other admin list changed %d %s", status, body)
	}
}

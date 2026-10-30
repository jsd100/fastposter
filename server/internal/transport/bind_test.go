package transport

import (
	"fastposter/server/gen/kitex/common"
	"github.com/cloudwego/hertz/pkg/app"
	"testing"
)

func TestBindingRejectsUnknownBodyFields(t *testing.T) {
	var r app.RequestContext
	r.Request.SetBodyString(`{"username":"poster","password":"example-password","role":"admin"}`)
	if _, e := bindInput[common.Credentials](&r); e == nil {
		t.Fatal("unknown privilege field accepted")
	}
}
func TestBindingParsesQueryTypesAndRejectsInvalidInt(t *testing.T) {
	var r app.RequestContext
	r.Request.SetRequestURI("/?page=2&pageSize=10&trash=true")
	q, e := bindInput[common.ProjectListQuery](&r)
	if e != nil || q.GetPage() != 2 || !q.GetTrash() {
		t.Fatalf("query binding failed: %+v %v", q, e)
	}
	r.Request.SetRequestURI("/?page=invalid")
	if _, e = bindInput[common.ProjectListQuery](&r); e == nil {
		t.Fatal("invalid page accepted")
	}
}

package transport

import (
	"context"
	"encoding/json"
	"fastposter/server/gen/kitex/common"
	"github.com/cloudwego/hertz/pkg/app"
	"testing"
)

func TestEmptyCatalogReplyIncludesRequiredArray(t *testing.T) {
	r := app.NewContext(0)
	g := Gateway{}
	g.write(context.Background(), r, "AdminResources", &common.CallContext{RequestId: "test"}, &common.RPCReply{Data: &common.PublicPayload{RequestId: "test", Resources: []*common.ResourceDTO{}}}, nil)
	var data map[string]any
	if e := json.Unmarshal(r.Response.Body(), &data); e != nil {
		t.Fatal(e)
	}
	if list, ok := data["resources"].([]any); !ok || len(list) != 0 {
		t.Fatal("required resources array omitted", data)
	}
}

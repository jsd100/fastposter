package copy

import (
	"context"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/testutil"
	"testing"
)

func copyFixture(t *testing.T) (*Service, auth.Principal, auth.Principal) {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES ('u1','admin','admin','disabled'),('u2','user','user','disabled')"); e != nil {
		t.Fatal(e)
	}
	return NewService(db, catalog.NewService(db, nil, nil)), auth.Principal{UserID: "u1", Role: "admin"}, auth.Principal{UserID: "u2", Role: "user"}
}

func saveCategory(t *testing.T, s *Service, p auth.Principal, title, parent string, published bool) catalog.Resource {
	t.Helper()
	r, e := s.SaveCategory(context.Background(), p, catalog.ResourceInput{Title: title, ParentID: parent, Published: published})
	if e != nil {
		t.Fatal(e)
	}
	return r
}

func TestRejectCyclesAndDepthSix(t *testing.T) {
	s, admin, user := copyFixture(t)
	ctx := context.Background()
	c1 := saveCategory(t, s, admin, "主题", "", true)
	c2 := saveCategory(t, s, admin, "场景", c1.ID, true)
	c3 := saveCategory(t, s, admin, "风格", c2.ID, true)
	c4 := saveCategory(t, s, admin, "语气", c3.ID, true)
	c5 := saveCategory(t, s, admin, "落款", c4.ID, true)
	if _, e := s.SaveCategory(ctx, admin, catalog.ResourceInput{Title: "第六层", ParentID: c5.ID, Published: true}); !isCode(e, "INVALID_INPUT") {
		t.Fatal("sixth level accepted", e)
	}
	if e := s.MoveCategory(ctx, admin, c1.ID, c5.ID); !isCode(e, "INVALID_INPUT") {
		t.Fatal("cycle accepted", e)
	}
	o1 := saveCategory(t, s, admin, "另一主题", "", true)
	if _, e := s.SaveCategory(ctx, admin, catalog.ResourceInput{Title: "另一场景", ParentID: o1.ID, Published: true}); e != nil {
		t.Fatal(e)
	}
	if e := s.MoveCategory(ctx, admin, o1.ID, c5.ID); !isCode(e, "INVALID_INPUT") {
		t.Fatal("subtree exceeding five levels accepted", e)
	}
	if e := s.MoveCategory(ctx, admin, c5.ID, c3.ID); e != nil {
		t.Fatal("valid re-parent rejected", e)
	}
	moved, e := s.Catalog.Get(ctx, admin, c5.ID, true)
	if e != nil || moved.ParentID != c3.ID {
		t.Fatal("category not moved", e)
	}
	if e = s.MoveCategory(ctx, user, c5.ID, ""); !isCode(e, "FORBIDDEN") {
		t.Fatal("ordinary user moved category", e)
	}
	if e = s.MoveCategory(ctx, admin, c5.ID, "missing-parent"); !isCode(e, "NOT_FOUND") {
		t.Fatal("missing parent accepted", e)
	}
}

func TestUnpublishedCopyHidden(t *testing.T) {
	s, admin, user := copyFixture(t)
	ctx := context.Background()
	category := saveCategory(t, s, admin, "促销", "", true)
	published, e := s.SaveCopy(ctx, admin, catalog.ResourceInput{Title: "公开", Body: "公开文案", CategoryID: category.ID, Published: true})
	if e != nil {
		t.Fatal(e)
	}
	hidden, e := s.SaveCopy(ctx, admin, catalog.ResourceInput{Title: "隐藏", Body: "隐藏文案", CategoryID: category.ID, Published: false})
	if e != nil {
		t.Fatal(e)
	}
	rows, total, e := s.ListEntries(ctx, user, category.ID, "", 1, 24, false)
	if e != nil || total != 1 || len(rows) != 1 || rows[0].Body != "公开文案" {
		t.Fatal("unpublished copy leaked to users", total, rows, e)
	}
	if _, _, e = s.ListEntries(ctx, admin, category.ID, "", 1, 24, true); e != nil {
		t.Fatal(e)
	}
	if _, e = s.Catalog.Get(ctx, user, hidden.ID, false); !isCode(e, "NOT_FOUND") {
		t.Fatal("unpublished copy readable", e)
	}
	if e = s.Unpublish(ctx, admin, published.ID); e != nil {
		t.Fatal(e)
	}
	if _, total, e = s.ListEntries(ctx, user, category.ID, "", 1, 24, false); e != nil || total != 0 {
		t.Fatal("unpublication did not hide copy", total, e)
	}
	if e = s.Publish(ctx, admin, published.ID); e != nil {
		t.Fatal(e)
	}
	if _, total, e = s.ListEntries(ctx, user, category.ID, "公开", 1, 24, false); e != nil || total != 1 {
		t.Fatal("search did not find republished copy", total, e)
	}
	if e = s.Unpublish(ctx, admin, category.ID); e != nil {
		t.Fatal(e)
	}
	categories, e := s.ListCategories(ctx, user, false)
	if e != nil || len(categories) != 0 {
		t.Fatal("unpublished category visible", categories, e)
	}
	if _, e = s.SaveCopy(ctx, user, catalog.ResourceInput{Title: "伪造", Body: "伪造正文", Published: true}); !isCode(e, "FORBIDDEN") {
		t.Fatal("ordinary user created copy", e)
	}
	if e = s.Publish(ctx, user, published.ID); !isCode(e, "FORBIDDEN") {
		t.Fatal("ordinary user published copy", e)
	}
}

func isCode(err error, code string) bool {
	var known *domain.Error
	return errors.As(err, &known) && known.Code == code
}

package catalog

import (
	"context"
	"database/sql"
	"fastposter/server/internal/domain"
)

type CategoryParents map[string]string

// LoadCategoryParents locks every live category of one kind so depth and cycle
// validation runs against a stable tree.
func LoadCategoryParents(ctx context.Context, tx *sql.Tx, kind string) (CategoryParents, error) {
	rows, e := tx.QueryContext(ctx, "SELECT id,parent_id FROM resources WHERE kind=? AND deleted_at IS NULL ORDER BY sort_order,title,id FOR UPDATE", kind)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := CategoryParents{}
	for rows.Next() {
		var id string
		var parent sql.NullString
		if e = rows.Scan(&id, &parent); e != nil {
			return nil, e
		}
		out[id] = parent.String
	}
	return out, rows.Err()
}

func (p CategoryParents) SubtreeHeight(id string) (int, error) {
	children := map[string][]string{}
	for child, parent := range p {
		children[parent] = append(children[parent], child)
	}
	visiting := map[string]bool{}
	var walk func(string) (int, error)
	walk = func(node string) (int, error) {
		if visiting[node] {
			return 0, domain.E("INVALID_INPUT", "分类树存在循环，请先修复分类")
		}
		visiting[node] = true
		height := 1
		for _, child := range children[node] {
			value, e := walk(child)
			if e != nil {
				return 0, e
			}
			if value+1 > height {
				height = value + 1
			}
		}
		visiting[node] = false
		return height, nil
	}
	return walk(id)
}

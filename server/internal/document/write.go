package document

import "errors"

// ErrSchemaDowngrade protects a stored v2 document from a v1 payload.
var ErrSchemaDowngrade = errors.New("schema version cannot be downgraded from v2 to v1")

// CheckWrite validates an incoming document and protects its stored schema
// version. A currentVersion of zero indicates a create.
func CheckWrite(currentVersion int, d Document) error {
	if e := Validate(d); e != nil {
		return e
	}
	if currentVersion == 2 && d.SchemaVersion == 1 {
		return ErrSchemaDowngrade
	}
	return nil
}

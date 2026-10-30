package testutil

import "testing"

func TestRefuseNonTestSchema(t *testing.T) {
	for _, dsn := range []string{"u:p@tcp(localhost:3306)/business", "u:p@tcp(localhost:3306)/fastposter", "u:p@tcp(localhost:3306)/"} {
		if _, e := ValidateTestDSN(dsn); e == nil {
			t.Fatal("non-test schema accepted")
		}
	}
	if _, e := ValidateTestDSN("u:p@tcp(localhost:3306)/fastposter_test_integration"); e != nil {
		t.Fatal(e)
	}
}

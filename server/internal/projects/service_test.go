package projects

import "testing"

func TestProjectTitleAndRevisionValidation(t *testing.T) {
	for _, title := range []string{"", "   ", string(make([]byte, 201))} {
		if _, e := validateTitle(title); e == nil {
			t.Fatal("invalid title accepted")
		}
	}
	for _, revision := range []string{"0", "-1", "1e3", "900719925474099312345", "01"} {
		if _, e := parseRevision(revision); e == nil {
			t.Fatal("invalid revision accepted", revision)
		}
	}
	if v, e := parseRevision("9007199254740993"); e != nil || v != 9007199254740993 {
		t.Fatal("revision lost precision")
	}
}

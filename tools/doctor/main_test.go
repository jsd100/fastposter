package main

import (
	"strings"
	"testing"
)

func TestDoctorCategorizesMissingExecutable(t *testing.T) {
	r := checkExecutable("magick", "/definitely/missing/magick")
	if r.OK || r.Component != "magick" || !strings.Contains(r.Message, "not installed") {
		t.Fatalf("unexpected result: %+v", r)
	}
}
func TestDoctorDoesNotLeakConnectionSecret(t *testing.T) {
	message := sanitizeDBError("poster:super-secret@tcp(localhost:3306)/fastposter", "dial tcp refused")
	if strings.Contains(message, "super-secret") || !strings.Contains(message, "MySQL") {
		t.Fatal("unsafe or unhelpful diagnostic")
	}
}

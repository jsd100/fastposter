package assets

import (
	"fmt"
	"strings"
	"testing"
)

func TestSafeNameUsesDetectedFormat(t *testing.T) {
	tests := []struct {
		name, format, want string
		fail               bool
	}{
		{name: "a.jpg", format: "png", want: "a.png"},
		{name: "a.PNG", format: "png", want: "a.png"},
		{name: "a", format: "jpeg", want: "a.jpg"},
		{name: "a.JPEG", format: "jpeg", want: "a.jpeg"},
		{name: "a.webp", format: "jpeg", want: "a.jpg"},
		{name: "my.photo", format: "webp", want: "my.webp"},
		{name: "../dir\\evil.PNG", format: "png", want: "evil.png"},
		{name: "bad\x00name.png", format: "png", want: "badname.png"},
		{name: "", format: "png", want: "background.png"},
		{name: "a.woff2", format: "woff2", want: "a.woff2"},
		{name: "a.png", format: "ttf", fail: true},
		{name: strings.Repeat("名", 201) + ".png", format: "png", fail: true},
	}
	for i, test := range tests {
		t.Run(fmt.Sprintf("%d_%s_%s", i, test.format, test.want), func(t *testing.T) {
			got, e := safeName(test.name, test.format)
			if test.fail {
				if e == nil {
					t.Fatalf("safeName(%q, %q) = %q, want error", test.name, test.format, got)
				}
				return
			}
			if e != nil || got != test.want {
				t.Fatalf("safeName(%q, %q) = %q, %v; want %q", test.name, test.format, got, e, test.want)
			}
		})
	}
}

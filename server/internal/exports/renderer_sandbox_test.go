package exports

import (
	"context"
	"reflect"
	"testing"

	"github.com/chromedp/chromedp"
)

// envLookup turns a small map into an os.Getenv-shaped lookup, so the gate can
// be exercised without touching process environment or launching Chrome.
func envLookup(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

// rendererNoSandbox reports whether the allocator options actually set the
// "no-sandbox" Chrome flag. Options are applied to a real (never launched)
// ExecAllocator; initFlags is read reflectively because chromedp does not
// export it. No browser process is started by this test.
func rendererNoSandbox(t *testing.T, opts []chromedp.ExecAllocatorOption) bool {
	t.Helper()
	ctx, cancel := chromedp.NewExecAllocator(context.Background())
	defer cancel()
	a, ok := chromedp.FromContext(ctx).Allocator.(*chromedp.ExecAllocator)
	if !ok {
		t.Fatal("allocator is not *chromedp.ExecAllocator")
	}
	for _, opt := range opts {
		opt(a)
	}
	flags := reflect.ValueOf(a).Elem().FieldByName("initFlags")
	if !flags.IsValid() || flags.Kind() != reflect.Map {
		t.Fatal("chromedp ExecAllocator no longer exposes initFlags; update this gate test")
	}
	return flags.MapIndex(reflect.ValueOf("no-sandbox")).IsValid()
}

// TestChromeSandboxGate pins the FASTPOSTER_CHROME_SANDBOX switch (E#5):
// only the exact value "1" restores the Chrome process sandbox. Every other
// value (including unset) keeps the restricted-host default of appending
// chromedp.NoSandbox. If the gate is removed in either direction, one of the
// subtests fails.
func TestChromeSandboxGate(t *testing.T) {
	cases := []struct {
		name          string
		env           map[string]string
		wantNoSandbox bool
	}{
		{"unset keeps restricted-host default", nil, true},
		{"empty keeps restricted-host default", map[string]string{"FASTPOSTER_CHROME_SANDBOX": ""}, true},
		{"1 restores the sandbox", map[string]string{"FASTPOSTER_CHROME_SANDBOX": "1"}, false},
		{"0 keeps restricted-host default", map[string]string{"FASTPOSTER_CHROME_SANDBOX": "0"}, true},
		{"true keeps restricted-host default", map[string]string{"FASTPOSTER_CHROME_SANDBOX": "true"}, true},
		{"on keeps restricted-host default", map[string]string{"FASTPOSTER_CHROME_SANDBOX": "on"}, true},
		{"whitespace keeps restricted-host default", map[string]string{"FASTPOSTER_CHROME_SANDBOX": " 1 "}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			opts := rendererChromeOptions("/chrome", envLookup(tc.env))
			if got := rendererNoSandbox(t, opts); got != tc.wantNoSandbox {
				t.Fatalf("no-sandbox flag present = %v, want %v (env=%v): FASTPOSTER_CHROME_SANDBOX gate removed or inverted", got, tc.wantNoSandbox, tc.env)
			}
			// chromedp.NoSandbox is exactly one ExecAllocatorOption, so the
			// gate must change the option count by exactly one as well.
			wantLen := len(chromedp.DefaultExecAllocatorOptions) + 3
			if tc.wantNoSandbox {
				wantLen++
			}
			if len(opts) != wantLen {
				t.Fatalf("allocator option count = %d, want %d (env=%v): gate removed or inverted", len(opts), wantLen, tc.env)
			}
		})
	}
}

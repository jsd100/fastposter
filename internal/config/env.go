package config

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

func ReadEnv(path string) (map[string]string, error) {
	out := map[string]string{}
	f, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return out, nil
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()
	scan := bufio.NewScanner(f)
	for scan.Scan() {
		line := strings.TrimSpace(scan.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			return nil, errors.New("invalid .env.local line")
		}
		out[strings.TrimSpace(k)] = strings.Trim(strings.TrimSpace(v), "\"'")
	}
	return out, scan.Err()
}
func Root() (string, error) {
	p, e := os.Getwd()
	if e != nil {
		return "", e
	}
	for {
		if _, e = os.Stat(filepath.Join(p, "go.mod")); e == nil {
			return p, nil
		}
		parent := filepath.Dir(p)
		if parent == p {
			return "", errors.New("run inside the FastPoster repository")
		}
		p = parent
	}
}
func FromRoot() (Config, error) {
	root, e := Root()
	if e != nil {
		return Config{}, e
	}
	env, e := ReadEnv(filepath.Join(root, ".env.local"))
	if e != nil {
		return Config{}, e
	}
	for k, v := range Environment() {
		env[k] = v
	}
	return Load(env, root)
}

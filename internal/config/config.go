package config

import (
	"errors"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	MySQLDSN, RedisAddr, AbsoluteDataDir, GatewayAddr, CoreAddr, ChromePath, MagickPath string
	CookieSecure                                                                        bool
	AppOrigins                                                                          []string
}

func Load(env map[string]string, baseDir string) (Config, error) {
	value := func(key, def string) string {
		if s := strings.TrimSpace(env[key]); s != "" {
			return s
		}
		return def
	}
	c := Config{MySQLDSN: value("MYSQL_DSN", ""), RedisAddr: value("REDIS_ADDR", ""), GatewayAddr: value("GATEWAY_ADDR", "127.0.0.1:8080"), CoreAddr: value("CORE_ADDR", "127.0.0.1:8888"), ChromePath: value("CHROME_PATH", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), MagickPath: value("MAGICK_PATH", "magick")}
	var e error
	c.CookieSecure, e = strconv.ParseBool(value("COOKIE_SECURE", "false"))
	if e != nil {
		return c, errors.New("invalid COOKIE_SECURE")
	}
	for _, origin := range strings.Split(value("APP_ORIGINS", "http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:5173,http://localhost:5174,http://127.0.0.1:8080,http://localhost:8080"), ",") {
		origin = strings.TrimSuffix(strings.TrimSpace(origin), "/")
		u, err := url.Parse(origin)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
			return c, errors.New("APP_ORIGINS must contain HTTP(S) origins only")
		}
		c.AppOrigins = append(c.AppOrigins, origin)
	}
	if c.MySQLDSN == "" {
		return c, errors.New("MYSQL_DSN is required; configure .env.local without committing credentials")
	}
	root := value("APP_DATA_DIR", "var/data")
	if !filepath.IsAbs(root) {
		root = filepath.Join(baseDir, root)
	}
	var err error
	c.AbsoluteDataDir, err = filepath.Abs(root)
	if err != nil {
		return c, errors.New("invalid APP_DATA_DIR")
	}
	if c.AbsoluteDataDir == string(filepath.Separator) {
		return c, errors.New("APP_DATA_DIR cannot be filesystem root")
	}
	for _, addr := range []string{c.GatewayAddr, c.CoreAddr} {
		if _, _, err = net.SplitHostPort(addr); err != nil {
			return c, errors.New("invalid service address; expected host:port")
		}
	}
	return c, nil
}
func Environment() map[string]string {
	out := map[string]string{}
	for _, s := range os.Environ() {
		k, v, ok := strings.Cut(s, "=")
		if ok {
			out[k] = v
		}
	}
	return out
}

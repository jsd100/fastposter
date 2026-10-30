package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fastposter/server/internal/domain"
	"fmt"
	"golang.org/x/crypto/argon2"
	"strconv"
	"strings"
	"unicode/utf8"
)

func HashPassword(password string) (string, error) {
	if utf8.RuneCountInString(password) < 8 || len(password) > 256 {
		return "", domain.E("INVALID_INPUT", "密码至少需要 8 个字符，且不能超过 256 字节")
	}
	salt := make([]byte, 16)
	if _, e := rand.Read(salt); e != nil {
		return "", e
	}
	hash := argon2.IDKey([]byte(password), salt, 3, 65536, 1, 32)
	return fmt.Sprintf("$argon2id$v=19$m=65536,t=3,p=1$%s$%s", base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}
func VerifyPassword(encoded, password string) bool {
	if len(password) > 256 {
		return false
	}
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" || parts[2] != "v=19" {
		return false
	}
	params := strings.Split(parts[3], ",")
	if len(params) != 3 {
		return false
	}
	values := make([]uint64, 3)
	for i, name := range []string{"m=", "t=", "p="} {
		if !strings.HasPrefix(params[i], name) {
			return false
		}
		n, e := strconv.ParseUint(strings.TrimPrefix(params[i], name), 10, 32)
		if e != nil {
			return false
		}
		values[i] = n
	}
	if values[0] < 8192 || values[0] > 131072 || values[1] < 1 || values[1] > 5 || values[2] < 1 || values[2] > 4 {
		return false
	}
	salt, e := base64.RawStdEncoding.DecodeString(parts[4])
	if e != nil || len(salt) != 16 {
		return false
	}
	expected, e := base64.RawStdEncoding.DecodeString(parts[5])
	if e != nil || len(expected) != 32 {
		return false
	}
	actual := argon2.IDKey([]byte(password), salt, uint32(values[1]), uint32(values[0]), uint8(values[2]), 32)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

package transport

import (
	"bytes"
	"encoding/json"
	"errors"
	"github.com/cloudwego/hertz/pkg/app"
	"io"
	"reflect"
	"strconv"
	"strings"
)

func bindInput[T any](r *app.RequestContext) (*T, error) {
	var out T
	if body := r.Request.Body(); len(body) > 0 {
		d := json.NewDecoder(bytes.NewReader(body))
		d.DisallowUnknownFields()
		if e := d.Decode(&out); e != nil {
			return nil, errors.New("请求字段或 JSON 格式不正确")
		}
		if e := d.Decode(new(any)); e != io.EOF {
			return nil, errors.New("JSON 包含额外内容")
		}
	}
	value := reflect.ValueOf(&out).Elem()
	typ := value.Type()
	for i := range typ.NumField() {
		name := strings.Split(typ.Field(i).Tag.Get("json"), ",")[0]
		if name == "" || name == "-" {
			continue
		}
		raw := r.Param(name)
		if raw == "" {
			raw = string(r.Query(name))
		}
		if raw == "" {
			continue
		}
		field := value.Field(i)
		if field.Kind() == reflect.Pointer {
			if field.Type().Elem().Kind() == reflect.Struct {
				continue
			}
			field.Set(reflect.New(field.Type().Elem()))
			field = field.Elem()
		}
		switch field.Kind() {
		case reflect.String:
			field.SetString(raw)
		case reflect.Int32, reflect.Int64:
			parsed, e := strconv.ParseInt(raw, 10, field.Type().Bits())
			if e != nil {
				return nil, errors.New("查询数字格式不正确")
			}
			field.SetInt(parsed)
		case reflect.Bool:
			parsed, e := strconv.ParseBool(raw)
			if e != nil {
				return nil, errors.New("查询布尔值格式不正确")
			}
			field.SetBool(parsed)
		}
	}
	return &out, nil
}

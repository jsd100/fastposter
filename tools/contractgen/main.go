package main

import (
	"encoding/json"
	"fmt"
	"github.com/cloudwego/thriftgo/parser"
	"go/format"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

type Route struct {
	Name         string   `json:"name"`
	Method       string   `json:"method"`
	Path         string   `json:"path"`
	PathFields   []string `json:"pathFields"`
	QueryFields  []string `json:"queryFields"`
	BodyFields   []string `json:"bodyFields"`
	RequestType  string   `json:"-"`
	ResponseType string   `json:"-"`
}
type Output struct {
	TypeScript string
	Routes     []Route
}

func shortName(s string) string { parts := strings.Split(s, "."); return parts[len(parts)-1] }
func annotation(items parser.Annotations, key string) string {
	for _, a := range items {
		if a.Key == key && len(a.Values) > 0 {
			return a.Values[0]
		}
	}
	return ""
}
func tsType(t *parser.Type, known map[string]bool) (string, error) {
	if t == nil {
		return "", fmt.Errorf("missing type")
	}
	switch t.Name {
	case "string":
		return "string", nil
	case "bool":
		return "boolean", nil
	case "i32", "double":
		return "number", nil
	case "i64":
		return "string", nil
	case "list":
		v, e := tsType(t.ValueType, known)
		return v + "[]", e
	case "map":
		if t.KeyType == nil || t.KeyType.Name != "string" {
			return "", fmt.Errorf("only string map keys supported")
		}
		v, e := tsType(t.ValueType, known)
		return "Record<string, " + v + ">", e
	case "byte", "i16", "set", "binary", "void":
		return "", fmt.Errorf("unsupported Thrift type: %s", t.Name)
	}
	n := shortName(t.Name)
	if !known[n] {
		return "", fmt.Errorf("unknown Thrift type: %s", t.Name)
	}
	return n, nil
}
func Generate(paths []string) (Output, error) {
	var output Output
	var trees []*parser.Thrift
	seen := map[string]bool{}
	var visit func(*parser.Thrift) error
	visit = func(tree *parser.Thrift) error {
		file, _ := filepath.Abs(tree.Filename)
		if seen[file] {
			return nil
		}
		seen[file] = true
		for _, inc := range tree.Includes {
			if inc.Reference == nil {
				return fmt.Errorf("unresolved include")
			}
			if e := visit(inc.Reference); e != nil {
				return e
			}
		}
		if len(tree.Unions) > 0 || len(tree.Exceptions) > 0 || len(tree.Typedefs) > 0 {
			return fmt.Errorf("unsupported union/exception/typedef")
		}
		trees = append(trees, tree)
		return nil
	}
	sort.Strings(paths)
	for _, path := range paths {
		tree, e := parser.ParseFile(path, []string{filepath.Dir(path)}, true)
		if e != nil {
			return output, e
		}
		if e = visit(tree); e != nil {
			return output, e
		}
	}
	known := map[string]bool{}
	structs := map[string]*parser.StructLike{}
	for _, tree := range trees {
		for _, s := range tree.Structs {
			if known[s.Name] {
				return output, fmt.Errorf("duplicate global DTO name: %s", s.Name)
			}
			known[s.Name] = true
			structs[s.Name] = s
		}
		for _, en := range tree.Enums {
			if known[en.Name] {
				return output, fmt.Errorf("duplicate enum name")
			}
			known[en.Name] = true
		}
	}
	var b strings.Builder
	b.WriteString("// Generated from Thrift. DO NOT EDIT.\nexport type Route<Q=unknown,R=unknown>={name:string;method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE';path:string;pathFields:string[];queryFields:string[];bodyFields:string[];_request?:Q;_response?:R};\n")
	for _, tree := range trees {
		for _, en := range tree.Enums {
			fmt.Fprintf(&b, "export enum %s {\n", en.Name)
			for _, v := range en.Values {
				fmt.Fprintf(&b, " %s = %d,\n", v.Name, v.Value)
			}
			b.WriteString("}\n")
		}
		for _, s := range tree.Structs {
			fmt.Fprintf(&b, "export interface %s {\n", s.Name)
			for _, f := range s.Fields {
				typ, e := tsType(f.Type, known)
				if e != nil {
					return output, e
				}
				optional := ""
				if f.Requiredness == parser.FieldType_Optional {
					optional = "?"
				}
				fmt.Fprintf(&b, " %s%s: %s;\n", f.Name, optional, typ)
			}
			b.WriteString("}\n")
		}
	}
	routeNames := map[string]bool{}
	for _, tree := range trees {
		for _, service := range tree.Services {
			for _, fn := range service.Functions {
				r := Route{Name: fn.Name, PathFields: []string{}, QueryFields: []string{}, BodyFields: []string{}}
				for _, method := range []string{"get", "post", "put", "patch", "delete"} {
					if path := annotation(fn.Annotations, "api."+method); path != "" {
						if r.Method != "" {
							return output, fmt.Errorf("multiple HTTP methods")
						}
						r.Method = strings.ToUpper(method)
						r.Path = path
					}
				}
				if r.Method == "" {
					continue
				}
				if routeNames[r.Name] || len(fn.Arguments) != 1 {
					return output, fmt.Errorf("duplicate endpoint or invalid signature")
				}
				routeNames[r.Name] = true
				if fn.FunctionType == nil {
					return output, fmt.Errorf("void HTTP response is unsupported")
				}
				r.RequestType = shortName(fn.Arguments[0].Type.Name)
				r.ResponseType = shortName(fn.FunctionType.Name)
				req := structs[r.RequestType]
				if req == nil || !known[r.ResponseType] {
					return output, fmt.Errorf("missing endpoint DTO")
				}
				for _, f := range req.Fields {
					if annotation(f.Annotations, "api.path") != "" {
						r.PathFields = append(r.PathFields, f.Name)
					} else if annotation(f.Annotations, "api.query") != "" || r.Method == "GET" {
						r.QueryFields = append(r.QueryFields, f.Name)
					} else {
						r.BodyFields = append(r.BodyFields, f.Name)
					}
				}
				output.Routes = append(output.Routes, r)
			}
		}
	}
	b.WriteString("export const routes = {\n")
	for _, r := range output.Routes {
		raw, _ := json.Marshal(r)
		fmt.Fprintf(&b, " %s: %s as Route<%s, %s>,\n", r.Name, raw, r.RequestType, r.ResponseType)
	}
	b.WriteString("};\n")
	output.TypeScript = b.String()
	return output, nil
}
func main() {
	paths, e := filepath.Glob("idl/http/*.thrift")
	if e != nil || len(paths) == 0 {
		fmt.Fprintln(os.Stderr, "no HTTP IDL files")
		os.Exit(1)
	}
	out, e := Generate(paths)
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	if e = os.WriteFile("packages/api-client/src/generated.ts", []byte(out.TypeScript), 0644); e != nil {
		panic(e)
	}
	raw, _ := json.MarshalIndent(out.Routes, "", "  ")
	if e = os.WriteFile("idl/http-routes.generated.json", append(raw, '\n'), 0644); e != nil {
		panic(e)
	}
	var g strings.Builder
	g.WriteString("// Code generated from Thrift. DO NOT EDIT.\npackage transport\ntype RouteSpec struct{Name,Method,Path string}\nvar GeneratedRoutes=[]RouteSpec{\n")
	for _, r := range out.Routes {
		fmt.Fprintf(&g, "{%q,%q,%q},\n", r.Name, r.Method, r.Path)
	}
	g.WriteString("}\n")
	formatted, e := format.Source([]byte(g.String()))
	if e != nil {
		panic(e)
	}
	if e = os.WriteFile("server/internal/transport/routes.gen.go", formatted, 0644); e != nil {
		panic(e)
	}
	root, e := os.Getwd()
	if e != nil {
		panic(e)
	}
	run := func(name string, args ...string) {
		path := filepath.Join(root, ".tools/bin", name)
		if name == "prettier" {
			path = filepath.Join(root, "node_modules/.bin/prettier")
		}
		cmd := exec.Command(path, args...)
		cmd.Env = append(os.Environ(), "PATH="+filepath.Join(root, ".tools/bin")+string(os.PathListSeparator)+os.Getenv("PATH"))
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "%s failed; install versions from deploy/toolchain.lock.json: %v\n", name, err)
			os.Exit(1)
		}
	}
	run("kitex", "-module", "fastposter", "-gen-path", "server/gen/kitex", "idl/rpc/core.thrift")
	for _, path := range paths {
		run("hz", "model", "-idl", path, "--mod", "fastposter", "--model_dir", "server/gen/hertz")
	}
	run("prettier", "--write", "packages/api-client/src/generated.ts")
}

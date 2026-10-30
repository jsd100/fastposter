package main

import (
	"context"
	"fastposter/internal/config"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
func run() error {
	root, e := config.Root()
	if e != nil {
		return e
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	bin := filepath.Join(root, ".tools/bin")
	if e = os.MkdirAll(bin, 0700); e != nil {
		return e
	}
	rendererBuild := exec.CommandContext(ctx, "pnpm", "--filter", "@fastposter/renderer", "build")
	rendererBuild.Dir = root
	rendererBuild.Stdout = os.Stdout
	rendererBuild.Stderr = os.Stderr
	if e = rendererBuild.Run(); e != nil {
		return e
	}
	for _, name := range []string{"core", "gateway", "export-worker"} {
		cmd := exec.CommandContext(ctx, "go", "build", "-o", filepath.Join(bin, name), "./server/cmd/"+name)
		cmd.Dir = root
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if e = cmd.Run(); e != nil {
			return fmt.Errorf("build %s: %w", name, e)
		}
	}
	commands := [][]string{{filepath.Join(bin, "core")}, {filepath.Join(bin, "gateway")}, {filepath.Join(bin, "export-worker")}, {"pnpm", "--filter", "@fastposter/web", "dev"}, {"pnpm", "--filter", "@fastposter/admin", "dev"}}
	var procs []*exec.Cmd
	done := make(chan error, len(commands))
	defer func() {
		for _, p := range procs {
			syscall.Kill(-p.Process.Pid, syscall.SIGTERM)
		}
		deadline := time.NewTimer(4 * time.Second)
		defer deadline.Stop()
		for range procs {
			select {
			case <-done:
			case <-deadline.C:
				for _, p := range procs {
					syscall.Kill(-p.Process.Pid, syscall.SIGKILL)
				}
				return
			}
		}
	}()
	for _, args := range commands {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = root
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
		if e = cmd.Start(); e != nil {
			return e
		}
		procs = append(procs, cmd)
		go func(c *exec.Cmd) { done <- c.Wait() }(cmd)
	}
	fmt.Println("FastPoster: http://127.0.0.1:5173  Admin: http://127.0.0.1:5174")
	select {
	case <-ctx.Done():
		return nil
	case e := <-done:
		if e == nil {
			return fmt.Errorf("a development process exited")
		}
		return e
	}
}

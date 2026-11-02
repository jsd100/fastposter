package storage

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

const MaintenanceGateName = ".fastposter-maintenance"
const maintenanceLockName = ".fastposter-maintenance.lock"

type gateInfo struct {
	PID     int   `json:"pid"`
	Started int64 `json:"started"`
}

type Maintenance struct {
	gate    string
	dir     string
	lock    *os.File
	writers *os.File
}

func BeginMaintenance(dir string) (*Maintenance, error) {
	abs, e := filepath.Abs(dir)
	if e != nil {
		return nil, e
	}
	if abs == string(filepath.Separator) {
		return nil, errors.New("unsafe storage root")
	}
	if e = os.MkdirAll(abs, 0700); e != nil {
		return nil, e
	}
	lock, e := os.OpenFile(filepath.Join(abs, maintenanceLockName), os.O_CREATE|os.O_RDWR, 0600)
	if e != nil {
		return nil, e
	}
	release := func() {
		syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
		lock.Close()
	}
	if e = syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); e != nil {
		release()
		return nil, errors.New("another maintenance operation is already running")
	}
	gate := filepath.Join(abs, MaintenanceGateName)
	payload, e := json.Marshal(gateInfo{PID: os.Getpid(), Started: time.Now().Unix()})
	if e != nil {
		release()
		return nil, e
	}
	tmp := gate + ".tmp"
	if e = os.WriteFile(tmp, payload, 0600); e != nil {
		release()
		return nil, e
	}
	if e = os.Rename(tmp, gate); e != nil {
		os.Remove(tmp)
		release()
		return nil, e
	}
	return &Maintenance{gate: gate, dir: abs, lock: lock}, nil
}

func (m *Maintenance) Close() error {
	if m == nil {
		return nil
	}
	var out error
	if e := os.Remove(m.gate); e != nil && !errors.Is(e, os.ErrNotExist) {
		out = e
	}
	if m.writers != nil {
		syscall.Flock(int(m.writers.Fd()), syscall.LOCK_UN)
		if e := m.writers.Close(); e != nil && out == nil {
			out = e
		}
		m.writers = nil
	}
	if m.lock != nil {
		syscall.Flock(int(m.lock.Fd()), syscall.LOCK_UN)
		if e := m.lock.Close(); e != nil && out == nil {
			out = e
		}
	}
	return out
}

func MaintenanceActive(dir string) bool {
	raw, e := os.ReadFile(filepath.Join(dir, MaintenanceGateName))
	if e != nil {
		return false
	}
	var info gateInfo
	if json.Unmarshal(raw, &info) != nil || info.PID <= 0 || info.Started <= 0 {
		return false
	}
	if time.Since(time.Unix(info.Started, 0)) > 12*time.Hour {
		return false
	}
	e = syscall.Kill(info.PID, 0)
	return e == nil || errors.Is(e, syscall.EPERM)
}

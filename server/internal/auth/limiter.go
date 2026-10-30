package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"github.com/redis/go-redis/v9"
	"sync"
	"time"
)

type bucket struct {
	Count int
	Until time.Time
}
type Limiter struct {
	mu           sync.Mutex
	client       *redis.Client
	limit        int
	window       time.Duration
	capacity     int
	entries      map[string]bucket
	redisRetryAt time.Time
}

func NewLimiter(client *redis.Client, limit int, window time.Duration, capacity int) *Limiter {
	return &Limiter{client: client, limit: limit, window: window, capacity: capacity, entries: map[string]bucket{}}
}
func (l *Limiter) Allow(ctx context.Context, key string) (bool, error) {
	if e := ctx.Err(); e != nil {
		return false, e
	}
	now := time.Now()
	l.mu.Lock()
	useRedis := l.client != nil && !now.Before(l.redisRetryAt)
	l.mu.Unlock()
	if useRedis {
		hash := sha256.Sum256([]byte(key))
		count, e := l.client.Eval(ctx, `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n`, []string{"fastposter:limit:" + hex.EncodeToString(hash[:])}, l.window.Milliseconds()).Int()
		if e == nil {
			return count <= l.limit, nil
		}
		if e = ctx.Err(); e != nil {
			return false, e
		}
		l.mu.Lock()
		l.redisRetryAt = now.Add(30 * time.Second)
		l.mu.Unlock()
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	entry, ok := l.entries[key]
	if !ok || !now.Before(entry.Until) {
		if !ok && len(l.entries) >= l.capacity {
			for k, v := range l.entries {
				if !now.Before(v.Until) {
					delete(l.entries, k)
				}
			}
			if len(l.entries) >= l.capacity {
				return false, nil
			}
		}
		entry = bucket{Until: now.Add(l.window)}
	}
	entry.Count++
	l.entries[key] = entry
	return entry.Count <= l.limit, nil
}

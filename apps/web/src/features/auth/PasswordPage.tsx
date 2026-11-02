import { useState, type FormEvent } from "react";
import { apiClient, routes } from "@fastposter/api-client";
import { Button, FormField, Status } from "@fastposter/ui";
import { errorMessage } from "../../api";
import { Link, navigate } from "../../router";
import { useSession } from "./Session";
export function PasswordPage() {
  const { setUser } = useSession();
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [username, setUsername] = useState(""),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const reset = new URLSearchParams(location.search).get("reset") === "1";
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiClient.request(routes.ChangePassword, {
        currentPassword: reset ? "" : current,
        newPassword: next,
        ...(reset ? { username, resetToken: token } : {}),
      });
      setUser(null);
      navigate("/login");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="simple-page">
      <form className="panel password-form" onSubmit={submit}>
        <Link href="/projects">← 返回作品</Link>
        <h1>{reset ? "重设密码" : "修改密码"}</h1>
        <p className="muted">更新后需要重新登录。</p>
        {reset ? (
          <>
            <FormField
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <FormField
              label="重置令牌"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </>
        ) : (
          <FormField
            label="当前密码"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        )}
        <FormField
          label="新密码"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        {error && <Status tone="error">{error}</Status>}
        <Button variant="primary" busy={busy} type="submit">
          更新密码
        </Button>
      </form>
    </main>
  );
}

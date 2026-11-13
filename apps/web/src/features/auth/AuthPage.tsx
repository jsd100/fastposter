import { BrandIcon } from "@fastposter/ui";
import { useState, type FormEvent } from "react";
import { apiClient, routes } from "@fastposter/api-client";
import { Button, FormField, useErrorNotice } from "@fastposter/ui";
import { Card, Typography } from "antd";
import { Link, navigate } from "../../router";
import { errorMessage } from "../../api";
import { useSession } from "./Session";
export function AuthPage({ register = false }: { register?: boolean }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const quickLogin =
    import.meta.env.DEV && !register
      ? {
          username: import.meta.env.VITE_QUICK_LOGIN_USERNAME as
            string | undefined,
          password: import.meta.env.VITE_QUICK_LOGIN_PASSWORD as
            string | undefined,
        }
      : null;
  const session = useSession();
  useErrorNotice("auth:form", error || null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (register) {
        await apiClient.request(routes.Register, { username, password });
        navigate("/login?registered=1");
      } else {
        const r = await apiClient.request(routes.Login, { username, password });
        session.setUser(r.user);
        navigate(r.user.mustChangePassword ? "/password" : "/projects");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <Link href="/login" className="brand">
        <BrandIcon />
        FastPoster
      </Link>
      <Card className="auth-card">
        <Typography.Title level={2}>
          {register ? "创建账号" : "登录"}
        </Typography.Title>
        <form onSubmit={submit} className="auth-form">
          <FormField
            label="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={2}
            maxLength={32}
            required
            autoFocus
          />
          <FormField
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={register ? "new-password" : "current-password"}
            minLength={8}
            maxLength={256}
            required
            hint={
              register ? "至少 8 个字符，建议混合字母、数字和符号。" : undefined
            }
          />
          {quickLogin?.username && quickLogin.password && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setUsername(quickLogin.username!);
                setPassword(quickLogin.password!);
                setError("");
              }}
            >
              填入快捷账号
            </Button>
          )}
          <Button variant="primary" busy={busy} type="submit">
            {register ? "创建账号" : "登录"}
          </Button>
          <p className="auth-switch">
            {register ? "已经有账号？" : "第一次来？"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "前往登录" : "创建账号"}
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}

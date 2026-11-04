import { BrandIcon } from "@fastposter/ui";
import { useState, type FormEvent } from "react";
import { apiClient, routes } from "@fastposter/api-client";
import { Button, FormField, useErrorNotice } from "@fastposter/ui";
import { ArrowUpRight, Layers3, MousePointer2, Download } from "lucide-react";
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
      <section className="auth-story">
        <Link href="/login" className="brand">
          <BrandIcon />
          FastPoster
        </Link>
        <div className="auth-copy">
          <span className="eyebrow">一点灵感，一张好海报</span>
          <h1>
            让文字
            <br />
            落在好风景里。
          </h1>
          <p>
            从一张喜欢的图片开始，
            <br />
            把你想说的话，变成值得分享的画面。
          </p>
          <div className="auth-demo" aria-hidden="true">
            <div className="demo-label">A LITTLE EVERY DAY</div>
            <div className="demo-lines">
              慢一点，
              <br />
              也没关系。
            </div>
            <div className="demo-footer">
              留一些时间，给自己。<span>◦ 2026</span>
            </div>
          </div>
        </div>
        <div className="auth-features">
          <span>
            <Layers3 size={16} />
            原图尺寸
          </span>
          <span>
            <MousePointer2 size={16} />
            自由排版
          </span>
          <span>
            <Download size={16} />
            无损导出
          </span>
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-mobile-brand brand">
          <BrandIcon />
          FastPoster
        </div>
        <form onSubmit={submit} className="auth-form">
          <span className="eyebrow">YOUR CREATIVE SPACE</span>
          <h2>{register ? "创建你的创作空间" : "欢迎回来"}</h2>
          <p className="muted">
            {register
              ? "保存灵感，让每一张海报都有迹可循。"
              : "登录后，继续你的海报创作。"}
          </p>
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
            <ArrowUpRight size={17} />
          </Button>
          <p className="auth-switch">
            {register ? "已经有账号？" : "第一次来？"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "前往登录" : "创建账号"}
            </Link>
          </p>
          <p className="auth-note">背景、文字与作品，保存在你的私人空间。</p>
        </form>
        <footer className="auth-copyright">FastPoster · 把灵感排成画面</footer>
      </section>
    </main>
  );
}

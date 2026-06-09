import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  analyzeRepository,
  type AnalysisResult,
  type CheckResult,
} from './lib/analyzer'

const EXAMPLE_REPOSITORY = 'https://github.com/qboiii821-ctrl/my-first-project'

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1.1.1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.5 4 18.5 4.3 18.5 4.3c.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.3 11.3 0 0 0 12 .7Z"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M4 10h12m-4.5-4.5L16 10l-4.5 4.5"
      />
    </svg>
  )
}

function CheckIcon({ status }: { status: CheckResult['status'] }) {
  if (status === 'pass') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="m5 10 3 3 7-7"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        d={status === 'warn' ? 'M10 5v6m0 3h.01' : 'M6 6l8 8m0-8-8 8'}
      />
    </svg>
  )
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="score-ring"
      style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}
      aria-label={`README 得分 ${score} 分`}
    >
      <div className="score-ring__inside">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  )
}

function App() {
  const [repository, setRepository] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const passedChecks = useMemo(
    () => result?.checks.filter((check) => check.status === 'pass').length ?? 0,
    [result],
  )

  async function runAnalysis(target = repository) {
    setError('')
    setIsLoading(true)

    try {
      const analysis = await analyzeRepository(target)
      setRepository(analysis.repository.url)
      setResult(analysis)
      window.setTimeout(() => {
        document
          .querySelector('#report')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (analysisError) {
      setResult(null)
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : '分析失败，请稍后再试。',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runAnalysis()
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Readme Doctor 首页">
          <span className="brand-mark">R<span>+</span></span>
          <span>Readme Doctor</span>
        </a>
        <nav aria-label="主导航">
          <a href="#how-it-works">工作原理</a>
          <a href="#report">评分项目</a>
          <a
            className="github-link"
            href="https://github.com/qboiii821-ctrl"
            target="_blank"
            rel="noreferrer"
          >
            <GithubIcon />
            GitHub
          </a>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="eyebrow">
            <span />
            为开源项目做一次发布前体检
          </div>
          <div className="hero-grid">
            <div className="hero-copy">
              <h1>
                让你的 README
                <br />
                <em>更值得一个 Star.</em>
              </h1>
              <p>
                输入公开 GitHub 仓库地址，快速检查项目介绍、安装说明、
                使用示例、截图、许可证等关键内容，并获得可执行的改进建议。
              </p>
              <form className="analyze-form" onSubmit={handleSubmit}>
                <label htmlFor="repository">GitHub 仓库地址</label>
                <div className="input-row">
                  <span className="input-icon">
                    <GithubIcon />
                  </span>
                  <input
                    id="repository"
                    type="text"
                    value={repository}
                    onChange={(event) => setRepository(event.target.value)}
                    placeholder="github.com/owner/repository"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button type="submit" disabled={isLoading}>
                    {isLoading ? '正在体检...' : '开始体检'}
                    {!isLoading && <ArrowIcon />}
                  </button>
                </div>
                {error && <p className="form-error">{error}</p>}
              </form>
              <button
                className="example-button"
                type="button"
                onClick={() => void runAnalysis(EXAMPLE_REPOSITORY)}
                disabled={isLoading}
              >
                没有仓库？检查示例项目
              </button>
            </div>

            <div className="hero-preview" aria-hidden="true">
              <div className="preview-window">
                <div className="window-bar">
                  <div className="window-dots"><i /><i /><i /></div>
                  <span>README REPORT</span>
                  <b>RD / 01</b>
                </div>
                <div className="preview-body">
                  <div className="preview-score">
                    <span className="preview-score__number">82</span>
                    <span className="preview-score__label">GOOD</span>
                  </div>
                  <div className="preview-info">
                    <small>REPOSITORY HEALTH</small>
                    <h2>你的项目距离优秀<br />只差几个细节。</h2>
                    <div className="mini-check"><i>✓</i> 项目介绍清晰</div>
                    <div className="mini-check"><i>✓</i> 包含安装步骤</div>
                    <div className="mini-check is-missing"><i>!</i> 缺少项目截图</div>
                  </div>
                </div>
                <div className="preview-footer">
                  <span>12 项自动检查</span>
                  <span>无需登录 · 免费使用</span>
                </div>
              </div>
              <div className="preview-stamp">OPEN<br />SOURCE</div>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="产品特点">
          <span>01</span><p>直接读取公开仓库</p>
          <span>02</span><p>12 项实用检查</p>
          <span>03</span><p>即时改进建议</p>
          <span>04</span><p>无需上传代码</p>
        </section>

        {result && (
          <section className="report-section" id="report">
            <div className="section-heading">
              <div>
                <span className="section-index">体检报告 / 01</span>
                <h2>{result.repository.fullName}</h2>
                <p>{result.repository.description || '该仓库暂未填写项目描述。'}</p>
              </div>
              <a
                href={result.repository.url}
                target="_blank"
                rel="noreferrer"
              >
                查看 GitHub 仓库 <ArrowIcon />
              </a>
            </div>

            <div className="report-summary">
              <div className="score-card">
                <ScoreRing score={result.score} />
                <div>
                  <span className="grade-label">{result.grade.label}</span>
                  <h3>{result.grade.title}</h3>
                  <p>{result.grade.description}</p>
                </div>
              </div>
              <div className="summary-stats">
                <div><strong>{passedChecks}</strong><span>通过项目</span></div>
                <div><strong>{result.checks.length - passedChecks}</strong><span>待改进</span></div>
                <div><strong>{result.repository.stars ?? '—'}</strong><span>当前 Stars</span></div>
              </div>
            </div>

            <div className="checks-grid">
              {result.checks.map((check, index) => (
                <article className={`check-card is-${check.status}`} key={check.id}>
                  <div className="check-card__top">
                    <span className="check-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="check-status">
                      <CheckIcon status={check.status} />
                    </span>
                  </div>
                  <h3>{check.title}</h3>
                  <p>{check.description}</p>
                  <div className="check-points">
                    <span>{check.points} / {check.maxPoints} 分</span>
                    <div>
                      <i style={{ width: `${(check.points / check.maxPoints) * 100}%` }} />
                    </div>
                  </div>
                  {check.recommendation && (
                    <p className="recommendation">
                      <b>建议</b>{check.recommendation}
                    </p>
                  )}
                </article>
              ))}
            </div>

            <div className="next-actions">
              <span className="section-index">优先行动 / 02</span>
              <h2>先完成这三项，提升最明显。</h2>
              <div>
                {result.recommendations.map((recommendation, index) => (
                  <article key={recommendation}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{recommendation}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="how-section" id="how-it-works">
          <div>
            <span className="section-index">工作原理 / 03</span>
            <h2>三步看懂你的项目首页。</h2>
          </div>
          <ol>
            <li><span>01</span><h3>输入仓库</h3><p>粘贴任意公开 GitHub 仓库链接。</p></li>
            <li><span>02</span><h3>自动检查</h3><p>读取 README 与公开仓库元数据。</p></li>
            <li><span>03</span><h3>立即改进</h3><p>根据分数和建议完善项目展示。</p></li>
          </ol>
        </section>
      </main>

      <footer>
        <a className="brand" href="#">
          <span className="brand-mark">R<span>+</span></span>
          <span>Readme Doctor</span>
        </a>
        <p>为认真做项目的人，认真检查 README。</p>
        <span>MIT License · 2026</span>
      </footer>
    </div>
  )
}

export default App

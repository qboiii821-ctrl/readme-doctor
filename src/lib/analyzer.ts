export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface CheckResult {
  id: string
  title: string
  description: string
  points: number
  maxPoints: number
  status: CheckStatus
  recommendation?: string
}

interface GitHubRepository {
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  homepage: string | null
  topics: string[]
  license: {
    spdx_id: string
  } | null
}

export interface AnalysisResult {
  repository: {
    fullName: string
    url: string
    description: string
    stars: number | null
  }
  score: number
  grade: {
    label: string
    title: string
    description: string
  }
  checks: CheckResult[]
  recommendations: string[]
}

const API_ROOT = 'https://api.github.com/repos'

function parseRepository(value: string) {
  const input = value.trim().replace(/\.git$/, '').replace(/\/$/, '')
  const urlMatch = input.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)/i,
  )
  const shortMatch = input.match(/^([^/\s]+)\/([^/\s]+)$/)
  const match = urlMatch ?? shortMatch

  if (!match) {
    throw new Error('请输入有效的 GitHub 仓库地址，例如 github.com/owner/repo。')
  }

  return {
    owner: match[1],
    repo: match[2],
  }
}

async function fetchRepository(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (response.status === 403) {
    return null
  }

  if (response.status === 404) {
    throw new Error('没有找到该公开仓库，请检查地址或仓库权限。')
  }

  if (!response.ok) {
    return null
  }

  return (await response.json()) as GitHubRepository
}

async function fetchRawFile(
  owner: string,
  repo: string,
  fileNames: string[],
) {
  for (const fileName of fileNames) {
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/HEAD/${fileName}`
    const response = await fetch(rawUrl)

    if (response.ok) {
      return await response.text()
    }
  }

  return ''
}

function statusFor(points: number, maxPoints: number): CheckStatus {
  if (points === maxPoints) return 'pass'
  if (points > 0) return 'warn'
  return 'fail'
}

function createCheck(
  id: string,
  title: string,
  description: string,
  points: number,
  maxPoints: number,
  recommendation?: string,
): CheckResult {
  return {
    id,
    title,
    description,
    points,
    maxPoints,
    status: statusFor(points, maxPoints),
    recommendation: points === maxPoints ? undefined : recommendation,
  }
}

function hasHeading(markdown: string, words: string[]) {
  const headings = markdown
    .split('\n')
    .filter((line) => /^#{1,6}\s+/.test(line))
    .join(' ')
    .toLowerCase()

  return words.some((word) => headings.includes(word.toLowerCase()))
}

function gradeFor(score: number) {
  if (score >= 85) {
    return {
      label: 'EXCELLENT',
      title: '这份 README 已经很有说服力。',
      description: '核心信息完整，访客能快速理解项目价值并开始使用。',
    }
  }

  if (score >= 70) {
    return {
      label: 'GOOD',
      title: '基础扎实，再补几个关键细节。',
      description: '项目已经容易理解，优先完善待改进项目即可明显提升体验。',
    }
  }

  if (score >= 45) {
    return {
      label: 'NEEDS WORK',
      title: '项目有内容，但访客还需要猜。',
      description: '补齐安装、用法和视觉示例，可以显著降低理解成本。',
    }
  }

  return {
    label: 'START HERE',
    title: '先让别人看懂项目，再谈传播。',
    description: '从项目介绍、安装步骤和使用示例开始完善 README。',
  }
}

export async function analyzeRepository(
  repositoryInput: string,
): Promise<AnalysisResult> {
  const { owner, repo } = parseRepository(repositoryInput)
  const baseUrl = `${API_ROOT}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  const [repository, readme, licenseFile, contributingFile] = await Promise.all([
    fetchRepository(baseUrl),
    fetchRawFile(owner, repo, ['README.md', 'readme.md', 'README.MD']),
    fetchRawFile(owner, repo, ['LICENSE', 'LICENSE.md', 'LICENSE.txt']),
    fetchRawFile(owner, repo, [
      'CONTRIBUTING.md',
      'contributing.md',
      'CONTRIBUTING',
    ]),
  ])

  const headingCount = (readme.match(/^#{1,6}\s+/gm) ?? []).length
  const linkCount = (readme.match(/\[[^\]]+]\([^)]+\)/g) ?? []).length
  const nonMarkupText = readme
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const readmePoints = readme ? 20 : 0
  const introPoints = nonMarkupText.length >= 180 ? 10 : nonMarkupText.length >= 70 ? 5 : 0
  const installPoints = hasHeading(readme, [
    'install',
    'installation',
    'getting started',
    'quick start',
    '安装',
    '开始使用',
    '快速开始',
  ])
    ? 12
    : 0
  const usagePoints = hasHeading(readme, [
    'usage',
    'example',
    'demo',
    'how to use',
    '使用',
    '示例',
    '演示',
  ])
    ? 12
    : 0
  const imagePoints = /!\[[^\]]*]\([^)]+\)|<img[\s>]/i.test(readme) ? 8 : 0
  const licensePoints =
    Boolean(licenseFile) ||
    (repository?.license && repository.license.spdx_id !== 'NOASSERTION') ||
    hasHeading(readme, ['license', '许可证', '开源协议'])
      ? 8
      : 0
  const contributionPoints =
    Boolean(contributingFile) ||
    hasHeading(readme, ['contributing', 'contribution', '贡献', '参与'])
      ? 7
      : 0
  const badgePoints = /shields\.io|badge\.svg|\[!\[[^\]]*]\(/i.test(readme)
    ? 5
    : 0
  const codePoints = /```[\w-]*\n[\s\S]+?```/m.test(readme) ? 6 : 0
  const structurePoints = headingCount >= 4 ? 5 : headingCount >= 2 ? 2 : 0
  const linkPoints = linkCount >= 2 ? 4 : linkCount === 1 ? 2 : 0
  const metadataPoints =
    Number(Boolean(repository?.description)) +
    Number(Boolean(repository?.homepage)) +
    Number(Boolean(repository?.topics.length))

  const checks: CheckResult[] = [
    createCheck(
      'readme',
      'README 文件',
      readme ? '仓库包含可读取的 README。' : '仓库中没有找到 README。',
      readmePoints,
      20,
      '在仓库根目录创建 README.md，这是访客了解项目的第一入口。',
    ),
    createCheck(
      'introduction',
      '项目介绍',
      introPoints === 10
        ? '项目说明具备足够的信息量。'
        : '项目介绍较短，访客可能无法快速理解价值。',
      introPoints,
      10,
      '用 2-3 句话说明项目解决什么问题、适合谁、有什么不同。',
    ),
    createCheck(
      'installation',
      '安装步骤',
      installPoints ? '包含清晰的安装或快速开始章节。' : '没有识别到安装说明。',
      installPoints,
      12,
      '增加“安装”或“快速开始”章节，并提供可直接复制的命令。',
    ),
    createCheck(
      'usage',
      '使用说明',
      usagePoints ? '包含使用、示例或演示章节。' : '没有识别到具体使用方法。',
      usagePoints,
      12,
      '展示一个最短可用示例，让读者在一分钟内看到结果。',
    ),
    createCheck(
      'visuals',
      '截图或演示',
      imagePoints ? 'README 包含图片或演示素材。' : 'README 暂无截图或演示图。',
      imagePoints,
      8,
      '加入一张核心界面截图或 GIF，让项目价值一眼可见。',
    ),
    createCheck(
      'license',
      '开源许可证',
      licensePoints ? '项目声明了开源许可证。' : '没有识别到开源许可证。',
      licensePoints,
      8,
      '添加 LICENSE 文件，并在 README 中标明协议类型。',
    ),
    createCheck(
      'contributing',
      '贡献指南',
      contributionPoints ? '包含贡献说明或 CONTRIBUTING 文件。' : '缺少贡献入口。',
      contributionPoints,
      7,
      '增加简短的贡献流程，说明如何提 Issue 和 Pull Request。',
    ),
    createCheck(
      'badges',
      '状态徽章',
      badgePoints ? 'README 使用了状态徽章。' : '项目顶部没有状态徽章。',
      badgePoints,
      5,
      '添加许可证、构建状态或版本徽章，增强项目信任感。',
    ),
    createCheck(
      'code',
      '代码示例',
      codePoints ? '包含格式化的代码或命令示例。' : '没有识别到代码块。',
      codePoints,
      6,
      '使用 Markdown 代码块提供安装命令或最小调用示例。',
    ),
    createCheck(
      'structure',
      '内容结构',
      structurePoints === 5
        ? '标题层级丰富，内容易于浏览。'
        : '章节数量较少，信息层次可以更清晰。',
      structurePoints,
      5,
      '使用二级标题拆分功能、安装、使用、贡献和许可证。',
    ),
    createCheck(
      'links',
      '相关链接',
      linkPoints === 4
        ? 'README 提供了足够的相关链接。'
        : '外部文档、演示或反馈入口较少。',
      linkPoints,
      4,
      '添加在线演示、完整文档或 Issue 页面链接。',
    ),
    createCheck(
      'metadata',
      '仓库资料',
      metadataPoints === 3
        ? '描述、主页和 Topics 均已完善。'
        : 'GitHub 仓库侧边栏资料尚未填完整。',
      metadataPoints,
      3,
      '在 GitHub About 区域填写描述、项目主页和 Topics。',
    ),
  ]

  const score = checks.reduce((total, check) => total + check.points, 0)
  const recommendations = checks
    .filter((check) => check.recommendation)
    .sort(
      (first, second) =>
        second.maxPoints - second.points - (first.maxPoints - first.points),
    )
    .slice(0, 3)
    .map((check) => check.recommendation as string)

  return {
    repository: {
      fullName: repository?.full_name ?? `${owner}/${repo}`,
      url: repository?.html_url ?? `https://github.com/${owner}/${repo}`,
      description: repository?.description ?? '',
      stars: repository?.stargazers_count ?? null,
    },
    score,
    grade: gradeFor(score),
    checks,
    recommendations,
  }
}

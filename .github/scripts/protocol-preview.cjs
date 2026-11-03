const MARKER = '<!-- bridgeflow-protocol-previews -->'

function isProtocolChange(file) {
  return ['added', 'modified', 'changed', 'renamed', 'copied'].includes(file.status) &&
    /^protocols\/.+\.(md|markdown)$/i.test(file.filename) &&
    !file.filename.startsWith('protocols/skills/') &&
    !/(^|\/)(README|AGENTS|SKILL)\.md$/i.test(file.filename)
}

function previewUrl(siteUrl, number, path) {
  const url = new URL(siteUrl)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid protocol site URL')
  url.search = ''
  url.hash = ''
  url.searchParams.set('workspace', 'default')
  url.searchParams.set('pr', String(number))
  if (path) url.searchParams.set('file', path.slice('protocols/'.length))
  return url.href
}

function buildComment(files, number, siteUrl) {
  const changed = files.filter(isProtocolChange)
  if (!changed.length) return `${MARKER}\nNo added or changed protocol documents remain in this PR.`
  let body = `${MARKER}\n### Protocol previews\n\n[Browse PR #${number}](${previewUrl(siteUrl, number)})\n\n`
  for (let index = 0; index < changed.length; index++) {
    const file = changed[index]
    const label = file.filename.slice('protocols/'.length)
      .replace(/[\\`*_{}\[\]()<>]/g, '\\$&').replace(/[\r\n]/g, ' ')
    const status = file.status === 'added' ? 'Added' : file.status === 'renamed' ? 'Renamed' : 'Changed'
    const line = `- **${status}:** [${label}](${previewUrl(siteUrl, number, file.filename)})\n`
    if (body.length + line.length > 58000) {
      body += `\n${changed.length - index} more protocol files are available in the PR browser.\n`
      break
    }
    body += line
  }
  return body + '\nLinks open the latest PR revision. The main website continues to show main protocols by default.'
}

async function updateProtocolComment({ github, owner, repo, number, siteUrl }) {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid pull request number')
  // Only GitHub metadata and filenames are read; no code from the PR is checked out.
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner, repo, pull_number: number, per_page: 100,
  })
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner, repo, issue_number: number, per_page: 100,
  })
  const previous = comments.find(comment =>
    comment.user?.type === 'Bot' && comment.body?.startsWith(MARKER))
  if (!previous && !files.some(isProtocolChange)) return
  const body = buildComment(files, number, siteUrl)
  if (previous) {
    if (previous.body !== body) await github.rest.issues.updateComment({
      owner, repo, comment_id: previous.id, body,
    })
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number: number, body })
  }
}

module.exports = { MARKER, isProtocolChange, previewUrl, buildComment, updateProtocolComment }

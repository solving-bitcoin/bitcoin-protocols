const assert = require('node:assert/strict')
const { test } = require('node:test')
const { MARKER, buildComment, updateProtocolComment } = require('./protocol-preview.cjs')
const siteUrl = 'https://solving-bitcoin.github.io/bitcoin-protocols/'

function mockGithub(files, comments = []) {
  const mutations = []
  const listFiles = () => {}
  const listComments = () => {}
  const github = {
    paginate: async (method, args) => {
      assert.equal(args.per_page, 100)
      return method === listFiles ? files : comments
    },
    rest: { pulls: { listFiles }, issues: {
      listComments,
      createComment: async args => mutations.push({ kind: 'create', ...args }),
      updateComment: async args => mutations.push({ kind: 'update', ...args }),
    } },
  }
  return { github, mutations }
}
const args = { owner: 'solving-bitcoin', repo: 'bitcoin-protocols', number: 12, siteUrl }

test('link added, modified, and renamed protocols with encoded paths', () => {
  const body = buildComment([
    { filename: 'protocols/new [one] #.md', status: 'added' },
    { filename: 'protocols/primitives/changed.md', status: 'modified' },
    { filename: 'protocols/renamed.markdown', status: 'renamed' },
    { filename: 'protocols/deleted.md', status: 'removed' },
    { filename: 'protocols/skills/a/SKILL.md', status: 'modified' },
    { filename: 'protocols/README.md', status: 'modified' },
    { filename: 'webapp/src/App.tsx', status: 'modified' },
  ], 12, siteUrl)
  assert.match(body, /\*\*Added:/)
  assert.match(body, /\*\*Changed:/)
  assert.match(body, /\*\*Renamed:/)
  assert.match(body, /pr=12&file=new\+%5Bone%5D\+%23.md/)
  assert.doesNotMatch(body, /deleted|SKILL|README|App.tsx/)
})

test('create once, update the bot comment, and leave human comments untouched', async () => {
  const files = [{ filename: 'protocols/new.md', status: 'added' }]
  const first = mockGithub(files, [{ id: 1, user: { type: 'User' }, body: MARKER }])
  await updateProtocolComment({ ...args, github: first.github })
  assert.equal(first.mutations[0].kind, 'create')
  const second = mockGithub(files, [{ id: 2, user: { type: 'Bot' }, body: MARKER }])
  await updateProtocolComment({ ...args, github: second.github })
  assert.equal(second.mutations[0].kind, 'update')
  assert.equal(second.mutations[0].comment_id, 2)
  const unchanged = mockGithub(files, [{ id: 2, user: { type: 'Bot' }, body: second.mutations[0].body }])
  await updateProtocolComment({ ...args, github: unchanged.github })
  assert.equal(unchanged.mutations.length, 0)
})

test('unrelated PRs get no comment, and removed changes clear stale links', async () => {
  const unrelated = mockGithub([{ filename: 'webapp/README.md', status: 'modified' }])
  await updateProtocolComment({ ...args, github: unrelated.github })
  assert.equal(unrelated.mutations.length, 0)
  const stale = mockGithub([], [{ id: 3, user: { type: 'Bot' }, body: MARKER + '\nold links' }])
  await updateProtocolComment({ ...args, github: stale.github })
  assert.match(stale.mutations[0].body, /No added or changed/)
})

test('large PRs keep comments within GitHub limits', () => {
  const files = Array.from({ length: 3000 }, (_, i) => ({ filename: `protocols/${'x'.repeat(100)}${i}.md`, status: 'added' }))
  const body = buildComment(files, 12, siteUrl)
  assert.ok(body.length < 60000)
  assert.match(body, /more protocol files/)
})

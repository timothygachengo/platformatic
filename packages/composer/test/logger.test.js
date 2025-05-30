'use strict'

const assert = require('node:assert')
const path = require('node:path')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const { setTimeout: wait } = require('node:timers/promises')
const { tmpdir } = require('node:os')

const { buildServer } = require('..')

test('should use logger options - formatters, timestamp, redact', async (t) => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1
  const file = path.join(process.env.LOG_DIR, 'service.log')
  const serviceRoot = path.join(__dirname, 'logger')

  const app = await buildServer(path.join(serviceRoot, 'platformatic.json'))
  t.after(async () => {
    await app.close()
  })
  await app.start()

  // wait for logger flush
  await wait(500)

  const content = readFileSync(file, 'utf8')
  const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg.startsWith('Server listening at http://127.0.0.1')))
})

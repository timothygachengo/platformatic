'use strict'

const assert = require('node:assert')
const path = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { execRuntime, stdioOutputToLogs } = require('./helpers')

test('should use full logger options - formatters, timestamp, redaction', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-options', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/logs' })
      requested = true
    },
    done: (message) => {
      return requested
    }
  })
  const logs = stdioOutputToLogs(stdout)

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Starting the service "app"...'))
  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Started the service "app"...'))
  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg.startsWith('Platformatic is now listening at http://127.0.0.1:')))
})

test('should inherit full logger options from runtime to a platformatic/service', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-options', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/logs' })
      requested = true
    },
    done: (message) => {
      return requested && message.includes('call route /logs')
    }
  })
  const logs = stdioOutputToLogs(stdout)

  assert.ok(logs.find(log => log.stdout.level === 'DEBUG' &&
    log.stdout.time.length === 24 && // isotime
    log.stdout.name === 'service' &&
    log.stdout.msg === 'Loading envfile...'))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Starting the service "app"...'))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Started the service "app"...'))

  assert.ok(logs.find(log => log.level === 'INFO' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg.startsWith('Platformatic is now listening at http://127.0.0.1:')))

  assert.ok(logs.find(log => {
    if (log.level === 'INFO' &&
      log.time.length === 24 && // isotime
      log.name === 'app') {
      return log.stdout.level === 'DEBUG' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.name === 'service' &&
        log.stdout.secret === '***HIDDEN***' &&
        log.stdout.msg === 'call route /logs'
    }
    return false
  }))
})

test('should inherit full logger options from runtime to different services', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-options-all', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/logs' })
      requested = true
    },
    done: (message) => {
      return requested
    }
  })
  const logs = stdioOutputToLogs(stdout)

  for (const t of ['composer', 'service', 'node']) {
    assert.ok(logs.find(log => log.level === 'INFO' &&
      log.time.length === 24 && // isotime
      log.name === 'service' &&
      log.msg === `Started the service "${t}"...`))
  }
})

test('should get json logs from thread services when they are not pino default config', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-options-all', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/' })
      requested = true
    },
    done: (message) => {
      return requested
    }
  })
  const logs = stdioOutputToLogs(stdout)
    .filter(log => log.caller === 'STDOUT')

  assert.ok(logs.find(log => {
    return log.stdout.level === 'INFO' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.name === 'service' &&
      log.stdout.msg === 'incoming request'
  }))

  assert.ok(logs.find(log => {
    return log.stdout.level === 'INFO' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.name === 'service' &&
      log.stdout.msg === 'request completed'
  }))
})

test('should handle logs from thread services as they are with captureStdio: false', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-no-capture', 'platformatic.json')

  let responses = 0
  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/service/' })
      await request(url, { path: '/node/' })
      requested = true
    },
    done: (message) => {
      if (message.includes('call route / on service')) {
        responses++
      } else if (message.includes('call route / on node')) {
        responses++
      }
      return requested && responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  assert.ok(logs.find(log => {
    return log.nodeLevel === 'debug' &&
      log.name === 'node' &&
      log.msg === 'call route / on node'
  }))

  assert.ok(logs.find(log => {
    return log.serviceLevel === 'debug' &&
      log.name === 'service' &&
      log.msg === 'call route / on service'
  }))

  assert.ok(logs.find(log => {
    return log.customLevelName === 'info' &&
      log.msg === 'Starting the service "node"...'
  }))

  assert.ok(logs.find(log => {
    return log.customLevelName === 'info' &&
      log.msg === 'Starting the service "service"...'
  }))

  assert.ok(logs.find(log => {
    return log.customLevelName === 'info' &&
      log.msg === 'Starting the service "composer"...'
  }))
})

test('should handle logs from thread services as they are with captureStdio: false and managementApi: false', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-no-capture-no-mgmt-api', 'platformatic.json')

  let responses = 0
  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/service/' })
      await request(url, { path: '/node/' })
      requested = true
    },
    done: (message) => {
      if (message.includes('call route / on service')) {
        responses++
      } else if (message.includes('call route / on node')) {
        responses++
      }
      return requested && responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  assert.ok(logs.find(log => {
    return log.nodeLevel === 'debug' &&
      log.name === 'node' &&
      log.msg === 'call route / on node'
  }))

  assert.ok(logs.find(log => {
    return log.serviceLevel === 'debug' &&
      log.name === 'service' &&
      log.msg === 'call route / on service'
  }))

  assert.ok(logs.find(log => {
    return log.customLevelName === 'info' &&
      log.msg === 'Starting the service "node"...'
  }))

  assert.ok(logs.find(log => {
    return log.customLevelName === 'info' &&
      log.msg === 'Starting the service "service"...'
  }))

  assert.ok(logs.find(log => {
    return log.customLevelName === 'info' &&
      log.msg === 'Starting the service "composer"...'
  }))
})

test('should use base and messageKey options', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-options-base-message-key', 'platformatic.json')

  let responses = 0
  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/service/' })
      await request(url, { path: '/node/' })
      requested = true
    },
    done: (message) => {
      if (message.includes('call route / on service')) {
        responses++
      } else if (message.includes('call route / on node')) {
        responses++
      }
      return requested && responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  assert.ok(logs.every(log => {
    return log.customBaseName === 'a' &&
      log.customBaseItem === 'b' &&
      (log.theMessage ? log.theMessage.length > 0 : true) &&
      (log.stdout ? log.stdout.theMessage.length > 0 : true)
  }))
})

test('should use null base in options', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-options-null-base', 'platformatic.json')

  let responses = 0
  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/service/' })
      await request(url, { path: '/node/' })
      requested = true
    },
    done: (message) => {
      if (message.includes('call route / on service')) {
        responses++
      } else if (message.includes('call route / on node')) {
        responses++
      }
      return requested && responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  assert.ok(logs.every(log => {
    const keys = Object.keys(log)
    return !keys.includes('pid') &&
      !keys.includes('hostname')
  }))
})

test('should use custom config', async t => {
  const configPath = path.join(__dirname, '..', 'fixtures', 'logger-custom-config', 'platformatic.json')

  let responses = 0
  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await request(url, { path: '/service/' })
      await request(url, { path: '/node/' })
      requested = true
    },
    done: (message) => {
      if (message.includes('request completed')) {
        responses++
      }
      return requested && responses > 2
    }
  })
  const logs = stdioOutputToLogs(stdout)

  assert.ok(logs.every(log => {
    const keys = Object.keys(log)
    return log.severity === 'INFO' &&
      log.message.length > 0 &&
      !keys.includes('pid') &&
      !keys.includes('hostname')
  }))
})

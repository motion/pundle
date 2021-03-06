import toposort from 'toposort'

const HMR_URL = `${document.currentScript.src}.pundle.hmr`

function isHMRAccepted(oldModules, moduleId, matchAgainst = moduleId) {
  const oldModule = oldModules[moduleId]
  if (!oldModule) {
    // New module, allow HMR
    return 'direct'
  }
  if (!oldModule.hot) {
    // HMR-Client when self updated
    // has no .hot
    return 'no'
  }

  if (oldModule.hot.declined.includes('*') || oldModule.hot.declined.includes(matchAgainst)) {
    return 'no'
  }
  if (oldModule.hot.accepted.includes('*') || oldModule.hot.accepted.includes(matchAgainst)) {
    return 'direct'
  }
  if (oldModule.parents.some(item => isHMRAccepted(oldModules, item, matchAgainst) !== 'no')) {
    return 'parent'
  }
  return 'no'
}
function getHMROrder(oldModules, moduleIds) {
  let rejected = false
  const nodes = []

  function iterate(moduleId) {
    const hmrAccepted = isHMRAccepted(oldModules, moduleId)
    if (hmrAccepted === 'no') {
      rejected = true
    }

    nodes.push([moduleId, null])
    if (hmrAccepted === 'direct') return

    const { parents } = oldModules[moduleId]
    parents.forEach(parent => {
      nodes.push([moduleId, parent])
      iterate(parent)
    })
  }
  moduleIds.forEach(iterate)
  if (rejected) {
    throw new Error(`HMR not applied because some modules rejected/did not accept it`)
  }

  // Remove null at the end
  return toposort(nodes).slice(0, -1)
}

function applyHMR(oldModules, moduleIds) {
  const updateOrder = getHMROrder(oldModules, moduleIds)
  updateOrder.forEach(moduleId => {
    const newModule = require.cache[moduleId]
    const oldModule = oldModules[moduleId] || null

    if (!newModule) {
      console.log('[HMR] Ignoring module because non-js', moduleId)
      return
    }

    if (oldModule) {
      oldModule.hot.disposeHandlers.forEach(function(callback) {
        callback(newModule.hot.data)
      })
    }
    if (newModule.invoked) {
      sbPundleModuleRegister(moduleId, newModule.callback)
    }
    sbPundleModuleRequire('$root', moduleId)
    if (oldModule) {
      oldModule.hot.successHandlers.forEach(function(callback) {
        callback()
      })
    }
  })
}

async function handleResponse(response) {
  if (response.type === 'status') {
    const { enabled } = response
    console.info(`[HMR] ${enabled ? 'Connected to server' : 'Not allowed by server'}`)

    return
  }
  if (response.type === 'update') {
    const promises = []
    const oldModules = { ...require.cache }
    const { paths, changedFiles, changedModules } = response

    console.log(`[HMR] Affected files ${changedFiles.map(item => `${item.format}:${item.filePath}`).join(', ')}`)

    paths.forEach(({ url, format }) => {
      if (format === 'js') {
        const script = document.createElement('script')
        script.type = 'application/javascript'
        script.src = `${sbPundleServer}${url}`
        promises.push(
          new Promise((resolve, reject) => {
            script.onload = resolve
            script.onerror = reject
          }),
        )
        document.body.appendChild(script)
        return
      }
      if (format === 'css') {
        const link = document.createElement('link')
        link.type = 'text/css'
        link.src = `${sbPundleServer}${url}`
        promises.push(
          new Promise((resolve, reject) => {
            link.onload = resolve
            link.onerror = reject
          }),
        )
        document.head.append(link)
        return
      }
      console.log('Unknown format for changed file', format)
    })
    await Promise.all(promises)
    console.log('[HMR] Loaded updated files - Applying changes now')
    applyHMR(oldModules, changedModules)

    return
  }
  console.error(`[HMR] Unknown response from server`, response)
}

async function main() {
  const response = await fetch(HMR_URL)
  const reader = response.body.getReader()

  async function read() {
    const { done, value } = await reader.read()
    const contents = new TextDecoder('utf-8').decode(value)
    let parsed
    try {
      parsed = JSON.parse(contents)
    } catch (error) {
      /* No Op */
    }
    if (parsed) {
      await handleResponse(parsed)
    }
    if (!done) {
      await read()
    }
  }

  read().catch(console.error)
}

main().catch(console.error)

sbPundle.moduleHooks.push(function(newModule) {
  const accepted = []
  const declined = []
  const successHandlers = []
  const disposeHandlers = []

  function addDisposeHandler(callback) {
    const index = disposeHandlers.indexOf(callback)
    if (index !== -1) {
      throw new Error('Module dispose handler is already attached')
    } else {
      disposeHandlers.push(callback)
    }
  }
  function removeDisposeHandler(callback) {
    const index = disposeHandlers.indexOf(callback)
    if (index !== -1) {
      disposeHandlers.splice(index, 1)
    }
  }

  const hot = {
    data: {},
    accepted,
    declined,
    successHandlers,
    disposeHandlers,
    status() {
      return 'check'
    },
    accept(arg1, arg2) {
      if (typeof arg1 === 'string' || Array.isArray(arg1)) {
        if (Array.isArray(arg1)) {
          accepted.push(...arg1)
        } else {
          accepted.push(arg1)
        }
        successHandlers.push(arg2)
      } else {
        if (typeof arg1 === 'function') {
          successHandlers.push(arg1)
        }
        accepted.push('*')
      }
    },
    decline(dependencies) {
      if (Array.isArray(dependencies)) {
        declined.push(...dependencies)
      } else {
        declined.push(dependencies || '*')
      }
    },
    check() {},
    apply() {},
    dispose: addDisposeHandler,
    addDisposeHandler,
    removeDisposeHandler,
    addStatusHandler() {},
    removeStatusHandler() {},
  }
  newModule.hot = hot
})

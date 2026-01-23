import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import as2 from 'activitystrea.ms'
import fetch from 'node-fetch'

describe('activitypub-mock', async () => {
  const domain = 'activitypub.example'
  let module
  let nockSetup

  it('can import the module', async () => {
    module = await import('../index.js')
    assert.ok(module)
    assert.strictEqual(typeof module, 'object')
  })

  it('has a nockSetup function', async () => {
    nockSetup = module.nockSetup
    assert.ok(nockSetup)
    assert.strictEqual(typeof nockSetup, 'function')
  })

  it('can run nockSetup', async () => {
    nockSetup(domain)
    assert.ok(true)
  })

  it('can get a mock user', async () => {
    const username = 'test1'
    const id = `https://${domain}/user/${username}`
    const result = await fetch(id)
    assert.strictEqual(result.status, 200)
    const json = await result.json()
    assert.strictEqual(json.id, id)
    assert.strictEqual(json.type, 'Person')
  })

  it('can get a mock object', async () => {
    const username = 'test1'
    const id = `https://${domain}/user/${username}/note/1`
    const result = await fetch(id)
    assert.strictEqual(result.status, 200)
    const json = await result.json()
    assert.strictEqual(json.id, id)
    assert.strictEqual(json.type, 'Note')
  })
})

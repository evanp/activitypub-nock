import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import as2 from 'activitystrea.ms'
import fetch from 'node-fetch'

describe('activitypub-mock', async () => {
  const domain = 'activitypub.example'
  const remote = 'remote.example'
  const shared = 'shared.example'

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

  it('can get a request body', async () => {
    const { getBody, resetBodies } = module
    const username = 'test1'
    const remotename = 'remote1'
    const id = `https://${domain}/user/${username}/inbox`
    const activity = await as2.import({
      'id': `https://${remote}/user/${remotename}/activity/1`,
      type: 'Activity',
      'actor': `https://${remote}/user/${remotename}`
    })
    const result = await fetch(id, {
      method: 'POST',
      body: await activity.write(),
      headers: {
        'Content-Type': 'application/activity+json'
      }
    })
    assert.strictEqual(result.status, 202)
    const body = getBody(id)
    assert.ok(body.match(remotename))
    resetBodies()
  })

  it('can setup a domain with a shared inbox', async () => {
    nockSetup(shared, { sharedInbox: true })
    assert.ok(true)
  })

  it('can get a mock user with a shared inbox', async () => {
    const username = 'test1'
    const id = `https://${shared}/user/${username}`
    const result = await fetch(id)
    assert.strictEqual(result.status, 200)
    const json = await result.json()
    assert.strictEqual(
      json.endpoints.sharedInbox,
      `https://${shared}/shared/inbox`
    )
  })

  it('can post to a shared inbox', async () => {
    const { getBody, resetBodies, postSharedInbox, resetSharedInbox } = module
    const username = 'test1'
    const remotename = 'remote1'
    const id = `https://${shared}/shared/inbox`
    const activity = await as2.import({
      'id': `https://${remote}/user/${remotename}/activity/2`,
      type: 'Activity',
      'actor': `https://${remote}/user/${remotename}`
    })
    const result = await fetch(id, {
      method: 'POST',
      body: await activity.write(),
      headers: {
        'Content-Type': 'application/activity+json'
      }
    })
    assert.strictEqual(result.status, 202)
    const body = getBody(id)
    assert.ok(body.match(remotename))
    assert.strictEqual(postSharedInbox[shared], 1)
    resetBodies()
    resetSharedInbox()
    assert.strictEqual(postSharedInbox[shared], 0)
    assert.ok(true)
  })
})

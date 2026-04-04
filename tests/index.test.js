import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import as2 from 'activitystrea.ms'
import fetch from 'node-fetch'
import { nockFormat } from '../index.js'

describe('activitypub-mock', async () => {
  const domain = 'activitypub.example'
  const remote = 'remote.example'
  const shared = 'shared.example'
  const limited = 'limited.example'

  let module
  let nockSetup
  let nockSignature
  let setBio

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
    await nockSetup(domain)
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

  it('can fail on a flaky inbox', async () => {
    const { postInbox, nockSetup } = module
    const username = 'flaky1'
    const remotename = 'remote1'
    const flaky = 'flaky.example'
    nockSetup(flaky, { flaky: true })
    const id = `https://${flaky}/user/${username}/inbox`
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
    assert.strictEqual(result.status, 503)
    assert.strictEqual(postInbox[username], 0)
    const result2 = await fetch(id, {
      method: 'POST',
      body: await activity.write(),
      headers: {
        'Content-Type': 'application/activity+json'
      }
    })
    assert.strictEqual(result2.status, 202)
    assert.strictEqual(postInbox[username], 1)
  })

  it('can get a mock collection', async () => {
    const username = 'test1'
    const id = `https://${domain}/user/${username}/collection/1`
    const result = await fetch(id)
    assert.strictEqual(result.status, 200)
    const json = await result.json()
    assert.strictEqual(json.id, id)
    assert.strictEqual(json.type, 'Collection')
  })

  it('has a nockSignature export', async () => {
    nockSignature = module?.nockSignature
    assert.ok(nockSignature)
    assert.strictEqual(typeof nockSignature, 'function')
  })

  it('can make a signature with hs2019 algorithm', async () => {
    const username = 'test'
    const date = new Date().toUTCString()
    const algorithm = 'hs2019'
    const signature = await nockSignature({
      url: `https://${remote}/user/ok/outbox`,
      date,
      username,
      algorithm
    })
    assert.ok(signature)
    assert.ok(signature.match(/hs2019/))
  })

  it('has a setBio export', async () => {
    setBio = module?.setBio
    assert.ok(setBio)
    assert.strictEqual(typeof setBio, 'function')
  })

  it('can set the bio for an actor', async () => {
    const username = 'test2'
    const bio = '<p>test bio</p>'
    setBio(username, bio, domain)
    const id = nockFormat({ username, domain })
    const result = await fetch(id)
    assert.ok(result.ok)
    const json = await result.json()
    assert.strictEqual(json.summary, bio)
  })

  it('can setup a domain with rate-limiting', async () => {
    nockSetup(limited, { rateLimit: true })
    assert.ok(true)
  })

  it('sets the headers for a rate-limit domain', async () => {
    const username = 'test3'
    const id = nockFormat({ username, domain: limited })
    const result = await fetch(id)
    assert.ok(result.ok)
    assert.ok(result.headers.get('x-ratelimit-limit'))
    assert.ok(result.headers.get('x-ratelimit-remaining'))
    assert.ok(result.headers.get('x-ratelimit-reset'))
  })

  describe('nockMessageSignature', async () => {
    let nockMessageSignature

    it('has a nockMessageSignature export', async () => {
      nockMessageSignature = module?.nockMessageSignature
      assert.ok(nockMessageSignature)
      assert.strictEqual(typeof nockMessageSignature, 'function')
    })

    it('can make a message signature with a full key URL', async () => {
      const username = 'test'
      const url = `https://${remote}/user/ok/outbox`
      const keyId = nockFormat({ username, key: true, domain })
      const result = await nockMessageSignature({ url, username, keyId, domain })
      assert.ok(result)
      assert.strictEqual(typeof result, 'object')
      assert.ok(result['signature-input'])
      assert.ok(result['signature-input'].match(/"@method"/))
      assert.ok(result['signature-input'].match(/"@authority"/))
      assert.ok(result['signature-input'].match(/"@path"/))
      assert.ok(result['signature-input'].includes(keyId))
      assert.ok(result['signature-input'].match(/alg="rsa-v1_5-sha256"/))
      assert.ok(result['signature-input'].match(/created=\d+/))
      assert.ok(result.signature)
      assert.ok(result.signature.match(/^sig1=:.+:$/))
    })

    it('can make a message signature with a full key URL and content-digest', async () => {
      const username = 'test'
      const url = `https://${remote}/user/ok/inbox`
      const keyId = nockFormat({ username, key: true, domain })
      const contentDigest = 'sha-256=:base64encodeddigest:'
      const result = await nockMessageSignature({ method: 'POST', url, contentDigest, username, keyId, domain })
      assert.ok(result)
      assert.ok(result['signature-input'].match(/"content-digest"/))
      assert.ok(result.signature)
      assert.ok(result.signature.match(/^sig1=:.+:$/))
    })

    it('can make a message signature with a fragment key URL', async () => {
      const username = 'test'
      const url = `https://${remote}/user/ok/outbox`
      const keyId = nockFormat({ username, domain }) + '#main-key'
      const result = await nockMessageSignature({ url, username, keyId, domain })
      assert.ok(result)
      assert.ok(result['signature-input'].includes(keyId))
      assert.ok(result.signature)
      assert.ok(result.signature.match(/^sig1=:.+:$/))
    })

    it('can make a message signature with a fragment key URL and content-digest', async () => {
      const username = 'test'
      const url = `https://${remote}/user/ok/inbox`
      const keyId = nockFormat({ username, domain }) + '#main-key'
      const contentDigest = 'sha-256=:base64encodeddigest:'
      const result = await nockMessageSignature({ method: 'POST', url, contentDigest, username, keyId, domain })
      assert.ok(result)
      assert.ok(result['signature-input'].includes(keyId))
      assert.ok(result['signature-input'].match(/"content-digest"/))
      assert.ok(result.signature)
      assert.ok(result.signature.match(/^sig1=:.+:$/))
    })

    it('can make a message signature for a URL with a query string', async () => {
      const username = 'test'
      const url = `https://${remote}/.well-known/webfinger?resource=acct:test@${remote}`
      const keyId = nockFormat({ username, key: true, domain })
      const result = await nockMessageSignature({ url, username, keyId, domain })
      assert.ok(result)
      assert.ok(result['signature-input'].match(/"@query"/))
      assert.ok(result.signature)
      assert.ok(result.signature.match(/^sig1=:.+:$/))
    })
  })
})

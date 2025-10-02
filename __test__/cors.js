import Hoa from 'hoa'
import { cors } from '../src/cors.js'

describe('CORS middleware for Hoa', () => {
  const app = new Hoa()

  // route: default cors (origin "*")
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api/')) {
      return cors()(ctx, next)
    }
    await next()
  })

  // route: specific origin, headers, methods, expose, maxAge, credentials
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api2/')) {
      return cors({
        origin: 'http://example.com',
        allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
        allowMethods: ['POST', 'GET', 'OPTIONS'],
        exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
        maxAge: 600,
        credentials: true,
      })(ctx, next)
    }
    await next()
  })

  // attach a pre-existing Vary header for /api3 to verify merging behavior
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api3/')) {
      ctx.res.set('Vary', 'accept-encoding')
    }
    await next()
  })

  // route: multiple origins
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api3/')) {
      return cors({ origin: ['http://example.com', 'http://example.org', 'http://example.dev'] })(ctx, next)
    }
    await next()
  })

  // route: function origin
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api4/')) {
      return cors({ origin: (origin) => (origin.endsWith('.example.com') ? origin : 'http://example.com') })(ctx, next)
    }
    await next()
  })

  // enable default CORS on /api5/
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api5/')) {
      return cors()(ctx, next)
    }
    await next()
  })

  // duplicate middleware application (idempotent)
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api6/')) {
      await cors({ origin: 'http://example.com' })(ctx, next)
      return cors({ origin: 'http://example.com' })(ctx, next)
    }
    await next()
  })

  // dynamic origin/methods based on origin
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api7/')) {
      return cors({
        origin: (origin) => (origin === 'http://example.com' ? origin : '*'),
        allowMethods: (origin) => (origin === 'http://example.com' ? ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'] : ['GET', 'HEAD']),
      })(ctx, next)
    }
    await next()
  })

  // promise-based origin
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api8/')) {
      return cors({ origin: (origin) => Promise.resolve(origin.endsWith('.example.com') ? origin : 'http://example.com') })(ctx, next)
    }
    await next()
  })

  // promise-based origin and methods
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api9/')) {
      return cors({
        origin: (origin) => Promise.resolve(origin === 'http://example.com' ? origin : '*'),
        allowMethods: (origin) => Promise.resolve(origin === 'http://example.com' ? ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'] : ['GET', 'HEAD']),
      })(ctx, next)
    }
    await next()
  })

  // credentials=true with wildcard origin, should fallback to specific Origin
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api10/')) {
      return cors({ origin: '*', credentials: true })(ctx, next)
    }
    await next()
  })

  // allowMethods explicitly null to cover empty methods branch
  app.use(async (ctx, next) => {
    if (ctx.req.pathname.startsWith('/api11/')) {
      return cors({ allowMethods: null })(ctx, next)
    }
    await next()
  })

  // handlers
  app.use(async (ctx, next) => {
    if (ctx.req.pathname === '/api/abc') { ctx.res.body = { success: true }; return }
    if (ctx.req.pathname === '/api2/abc') { ctx.res.body = { success: true }; return }
    if (ctx.req.pathname === '/api3/abc') { ctx.res.body = { success: true }; return }
    if (ctx.req.pathname === '/api4/abc') { ctx.res.body = { success: true }; return }
    if (ctx.req.pathname === '/api5/abc') { ctx.res.body = new Response(JSON.stringify({ success: true })); return }
    if (ctx.req.pathname === '/api7/abc') { ctx.res.body = new Response(JSON.stringify({ success: true })); return }
    if (ctx.req.pathname === '/api10/abc') { ctx.res.body = { success: true }; return }
    if (ctx.req.pathname === '/api11/abc') { ctx.res.body = { success: true }; return }
    await next()
  })

  it('GET default', async () => {
    const res = await app.fetch(new Request('http://localhost/api/abc'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Vary')).toBeNull()
  })

  it('Preflight default', async () => {
    const req = new Request('https://localhost/api/abc', { method: 'OPTIONS' })
    req.headers.append('Access-Control-Request-Headers', 'X-PINGOTHER, Content-Type')
    const res = await app.fetch(req)
    expect(res.status).toBe(204)
    expect(res.statusText).toBe('No Content')
    expect(res.headers.get('Access-Control-Allow-Methods')?.split(',')[0]).toBe('GET')
    expect(res.headers.get('Access-Control-Allow-Headers')?.split(',')).toEqual(['X-PINGOTHER', 'Content-Type'])
  })

  it('Preflight with options', async () => {
    const req = new Request('https://localhost/api2/abc', { method: 'OPTIONS', headers: { origin: 'http://example.com' } })
    const res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
    expect(res.headers.get('Vary')?.split(/\s*,\s*/)).toEqual(expect.arrayContaining(['Origin']))
    expect(res.headers.get('Access-Control-Allow-Headers')?.split(/\s*,\s*/)).toEqual(['X-Custom-Header', 'Upgrade-Insecure-Requests'])
    expect(res.headers.get('Access-Control-Allow-Methods')?.split(/\s*,\s*/)).toEqual(['POST', 'GET', 'OPTIONS'])
    expect(res.headers.get('Access-Control-Expose-Headers')?.split(/\s*,\s*/)).toEqual(['Content-Length', 'X-Kuma-Revision'])
    expect(res.headers.get('Access-Control-Max-Age')).toBe('600')
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('Disallow an unmatched origin', async () => {
    const req = new Request('https://localhost/api2/abc', { method: 'OPTIONS', headers: { origin: 'http://example.net' } })
    const res = await app.fetch(req)
    expect(res.headers.has('Access-Control-Allow-Origin')).toBeFalsy()
  })

  it('Allow multiple origins', async () => {
    let req = new Request('http://localhost/api3/abc', { headers: { Origin: 'http://example.org' } })
    let res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.org')

    req = new Request('http://localhost/api3/abc')
    res = await app.fetch(req)
    expect(res.headers.has('Access-Control-Allow-Origin')).toBeFalsy()

    req = new Request('http://localhost/api3/abc', { headers: { Referer: 'http://example.net/' } })
    res = await app.fetch(req)
    expect(res.headers.has('Access-Control-Allow-Origin')).toBeFalsy()
  })

  it('Allow different Vary header value', async () => {
    const res = await app.fetch(new Request('http://localhost/api3/abc', { headers: { Origin: 'http://example.com' } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
    expect(res.headers.get('Vary')).toBe('accept-encoding, Origin')
  })

  it('Allow origins by function', async () => {
    let req = new Request('http://localhost/api4/abc', { headers: { Origin: 'http://subdomain.example.com' } })
    let res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://subdomain.example.com')

    req = new Request('http://localhost/api4/abc')
    res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')

    req = new Request('http://localhost/api4/abc', { headers: { Referer: 'http://evil-example.com/' } })
    res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
  })

  it('Allow origins by promise returning function', async () => {
    let req = new Request('http://localhost/api8/abc', { headers: { Origin: 'http://subdomain.example.com' } })
    let res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://subdomain.example.com')

    req = new Request('http://localhost/api8/abc')
    res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')

    req = new Request('http://localhost/api8/abc', { headers: { Referer: 'http://evil-example.com/' } })
    res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
  })

  it('With raw Response object', async () => {
    const res = await app.fetch(new Request('http://localhost/api5/abc'))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Vary')).toBeNull()
  })

  it('Should not return duplicate header values', async () => {
    const res = await app.fetch(new Request('http://localhost/api6/abc', { headers: { origin: 'http://example.com' } }))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
  })

  it('Allow methods by function', async () => {
    const req = new Request('http://localhost/api7/abc', { headers: { Origin: 'http://example.com' }, method: 'OPTIONS' })
    const res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,HEAD,POST,PATCH,DELETE')

    const req2 = new Request('http://localhost/api7/abc', { headers: { Origin: 'http://example.org' }, method: 'OPTIONS' })
    const res2 = await app.fetch(req2)
    expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res2.headers.get('Access-Control-Allow-Methods')).toBe('GET,HEAD')
  })

  it('Allow methods by promise returning function', async () => {
    const req = new Request('http://localhost/api9/abc', { headers: { Origin: 'http://example.com' }, method: 'OPTIONS' })
    const res = await app.fetch(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,HEAD,POST,PATCH,DELETE')

    const req2 = new Request('http://localhost/api9/abc', { headers: { Origin: 'http://example.org' }, method: 'OPTIONS' })
    const res2 = await app.fetch(req2)
    expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res2.headers.get('Access-Control-Allow-Methods')).toBe('GET,HEAD')
  })
  it('Wildcard origin with credentials falls back to specific Origin', async () => {
    const res = await app.fetch(new Request('http://localhost/api10/abc', { headers: { Origin: 'http://example.com' } }))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    expect(res.headers.get('Vary')).toBe('Origin')
  })
  it('Preflight with allowMethods=null does not set Allow-Methods', async () => {
    const req = new Request('http://localhost/api11/abc', { method: 'OPTIONS', headers: { Origin: 'http://example.com' } })
    const res = await app.fetch(req)
    expect(res.status).toBe(204)
    expect(res.headers.has('Access-Control-Allow-Methods')).toBe(false)
  })
})

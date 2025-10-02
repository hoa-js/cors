/**
 * @typedef {Object} CORSOptions
 * @property {string | string[] | ((origin: string, ctx: import('hoa').HoaContext) => Promise<string | undefined | null> | string | undefined | null)} origin
 * @property {string[] | ((origin: string, ctx: import('hoa').HoaContext) => Promise<string[]> | string[])} [allowMethods]
 * @property {string[]} [allowHeaders]
 * @property {number} [maxAge]
 * @property {boolean} [credentials]
 * @property {string[]} [exposeHeaders]
 */

/**
 * CORS middleware for Hoa.
 *
 * Based on Hono's CORS middleware approach, adapted to Hoa's Context/Request/Response APIs.
 *
 * Options:
 * - origin: string | string[] | function to determine the allowed Origin
 * - allowMethods: string[] | function for allowed methods (used for preflight)
 * - allowHeaders: string[] for allowed request headers (preflight); when empty, it echoes Access-Control-Request-Headers
 * - maxAge: seconds to cache the preflight response
 * - credentials: whether credentials are allowed
 * - exposeHeaders: response headers exposed to the browser
 *
 * @param {CORSOptions} [options]
 * @returns {(ctx: import('hoa').HoaContext, next: () => Promise<void>) => Promise<void>}
 */
export function cors (options = {}) {
  const defaults = {
    origin: '*',
    allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
    allowHeaders: [],
    exposeHeaders: []
  }

  const opts = { ...defaults, ...options }

  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === 'string') {
      if (optsOrigin === '*') {
        return () => optsOrigin
      } else {
        return (origin) => (optsOrigin === origin ? origin : null)
      }
    } else if (typeof optsOrigin === 'function') {
      return optsOrigin
    } else {
      return (origin) => (optsOrigin.includes(origin) ? origin : null)
    }
  })(opts.origin)

  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === 'function') {
      return optsAllowMethods
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods
    } else {
      return () => []
    }
  })(opts.allowMethods)

  return async function corsMiddleware (ctx, next) {
    const origin = ctx.req.get('origin') || ''
    let allowOrigin = await findAllowOrigin(origin, ctx)

    // If credentials are enabled and allowOrigin is "*", fallback to the specific request Origin
    if (opts.credentials && allowOrigin === '*') {
      allowOrigin = origin
    }

    if (allowOrigin) {
      ctx.res.set('Access-Control-Allow-Origin', allowOrigin)
    }

    // When returning an explicit Allow-Origin (not "*"), set Vary: Origin
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
    if (allowOrigin && allowOrigin !== '*') {
      ctx.res.append('Vary', 'Origin')

      // Only allow credentials when we return a specific origin
      if (opts.credentials) {
        ctx.res.set('Access-Control-Allow-Credentials', 'true')
      }
    }

    if (opts.exposeHeaders?.length) {
      ctx.res.set('Access-Control-Expose-Headers', opts.exposeHeaders.join(','))
    }

    if (ctx.req.method === 'OPTIONS') {
      if (opts.maxAge != null) {
        ctx.res.set('Access-Control-Max-Age', String(opts.maxAge))
      }

      const allowMethods = await findAllowMethods(origin, ctx)
      if (allowMethods.length) {
        ctx.res.set('Access-Control-Allow-Methods', allowMethods.join(','))
      }

      let allowHeaders = opts.allowHeaders
      if (!allowHeaders?.length) {
        const requestHeaders = ctx.req.get('Access-Control-Request-Headers')
        if (requestHeaders) {
          allowHeaders = requestHeaders.split(/\s*,\s*/)
        }
      }

      if (allowHeaders?.length) {
        ctx.res.set('Access-Control-Allow-Headers', allowHeaders.join(','))
        ctx.res.append('Vary', 'Access-Control-Request-Headers')
      }

      // Remove entity headers to ensure 204 has no body
      ctx.res.delete('Content-Length')
      ctx.res.delete('Content-Type')

      ctx.res.status = 204
      ctx.res.body = null
      return
    }

    await next()
  }
}

export default cors

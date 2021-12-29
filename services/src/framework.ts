import { pathToRegexp, match } from 'path-to-regexp'
import { AllParams, API, Method, StrangemoodServices } from './types'

type Resolver<T> = (
  request: Request,
  ctx: {
    params: T
    pattern: string
  },
) => Promise<Response>

interface Route<T> {
  pattern: string
  method: string
  resolver: Resolver<T>
}

/**
 * A tiny http router for our cloudflare worker
 * ```
 * // Create the router!
 * const app = new Router();
 *
 * // Add some routes
 * app.use("POST", "/listings/:public_key", async (request, ctx) => {
 *   return new Response(`${JSON.stringify(ctx)}`)
 * })
 *
 * // Execute the worker!
 * return app.resolve(request);
 * ```
 */
export default class Router {
  private routes: Route<any>[] = []

  // Adds a route
  async use<Params extends any>(
    method: Method,
    pattern: string,
    resolver: Resolver<Params>,
  ) {
    this.routes.push({
      method: method as string,
      pattern: pattern as string,
      resolver,
    })
  }

  // Runs the correct resolver for the request
  async resolve(request: Request) {
    return this.runResolver(request, this.routes)
  }

  private async runResolver(request: Request, routes: Route<any>[]) {
    let url = new URL(request.url)
    let method = request.method

    for (let route of routes) {
      if (route.method !== method) continue

      const matcher = match(route.pattern, { decode: decodeURIComponent })
      let result = matcher(url.pathname)
      if (!result) continue
      else {
        return route.resolver(request, {
          params: result.params,
          pattern: result.path,
        })
      }
    }

    return new Response(
      `404: This route ${method} '${url.pathname}' doesn't exist.`,
      {
        status: 404,
      },
    )
  }
}

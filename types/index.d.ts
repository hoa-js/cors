import type { HoaContext } from 'hoa'

export type CORSOrigin =
  | string
  | string[]
  | ((origin: string, ctx: HoaContext) => string | null | undefined | Promise<string | null | undefined>)

export type CORSAllowMethods =
  | string[]
  | ((origin: string, ctx: HoaContext) => string[] | Promise<string[]>)

export interface CORSOptions {
  origin?: CORSOrigin
  allowMethods?: CORSAllowMethods
  allowHeaders?: string[]
  maxAge?: number
  credentials?: boolean
  exposeHeaders?: string[]
}

export type CorsMiddleware = (ctx: HoaContext, next: () => Promise<void>) => Promise<void>

export function cors(options?: CORSOptions): CorsMiddleware

export default cors
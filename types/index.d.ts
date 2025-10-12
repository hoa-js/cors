import type { HoaContext, HoaMiddleware } from 'hoa'

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

export function cors(options?: CORSOptions): HoaMiddleware

export default cors
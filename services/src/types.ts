import { OpenMetaGraph } from './omg'

export type Method = 'POST' | 'GET' | 'DELETE' | 'PUT' | 'PATCH' | 'OPTIONS'
export type BodyMethods = 'POST' | 'PUT' | 'PATCH'

export interface RequestWithIncomingBody<RequestBody, ResponseBody, Params> {
  requestBody: RequestBody
  responseBody: ResponseBody
  params: Params
}

export interface Request<ResponseBody, Params> {
  responseBody: ResponseBody
  params: Params
}

export type API<RequestBody, ResponseBody, Params> = {
  [pattern: string]: {
    [method: string]:
      | RequestWithIncomingBody<RequestBody, ResponseBody, Params>
      | Request<ResponseBody, Params>
  }
}

export type Scope = `listing/${string}`

export interface ChallengeRequestBody {
  scope: Scope
}

export interface PublicKeyParams {
  publicKey: string
}

export interface EmptyParams {}
export type StringResponseBody = string

export interface StrangemoodServices extends API<any, any, any> {
  '/v1/challenge/:publicKey': {
    POST: {
      requestBody: ChallengeRequestBody
      responseBody: StringResponseBody
      requestHeaders: {
        'Content-Type': 'application/json'
      }
      params: PublicKeyParams
    }
  }

  '/v1/listings/:publicKey': {
    POST: {
      requestBody: OpenMetaGraph
      responseBody: OpenMetaGraph
      requestHeaders: {
        'Content-Type': 'application/json'
        Authorization: string
      }
      params: PublicKeyParams
    }
    GET: {
      responseBody: OpenMetaGraph
      params: PublicKeyParams
    }
  }
}

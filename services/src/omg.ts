export interface UriElement {
  key: string
  type: string
  uri: string
}

export interface ValueElement {
  key: string
  type: string
  uri: string
}

export interface OpenMetaGraph {
  version: '0.1.0'
  elements: Array<UriElement | ValueElement>
}

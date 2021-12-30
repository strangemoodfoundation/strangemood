function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
    'Access-Control-Allow-Headers':
      req.headers.get('Access-Control-Request-Headers') || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  }
}

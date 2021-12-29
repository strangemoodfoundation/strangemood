export const errs = {
  expectedJson() {
    return new Response('Body must be JSON', {
      status: 400,
    })
  },
}

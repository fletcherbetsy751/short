import qs from 'querystring'
import type { z } from 'zod'
import { parsePath } from 'ufo'
import type { LinkSchema } from '@/schemas/link'

export default eventHandler(async (event) => {
  const { pathname: slug, search } = parsePath(event.path.slice(1)) // remove leading slash
  const { slugRegex, reserveSlug } = useAppConfig(event)
  const { homeURL } = useRuntimeConfig(event)
  const { cloudflare } = event.context

  if (event.path === '/' && homeURL)
    return sendRedirect(event, homeURL)

  if (slug && !reserveSlug.includes(slug) && slugRegex.test(slug) && cloudflare) {
    const { KV } = cloudflare.env
    const link: z.infer<typeof LinkSchema> | null = await KV.get(`link:${slug}`, { type: 'json' })

    if (link) {
      const _linkUrl = link.url.split('?')
      const newLink = _linkUrl[0]
      let linkQs = { ...qs.parse(search?.replaceAll('?', '')) }
      if (_linkUrl?.[1]) {
        console.log(linkQs, _linkUrl)
        linkQs = { ...linkQs, ...qs.parse(`${_linkUrl[1]}`) }
        console.log(linkQs)
      }
      const _link: z.infer<typeof LinkSchema> = {
        ...link,
        url: `${newLink}?${qs.stringify(linkQs)}`,
      }
      event.context.link = _link
      try {
        await useAccessLog(event)
      }
      catch (error) {
        console.error('Failed write access log:', error)
      }
      console.log({ status: 'pass trycatch', _link })
      return sendRedirect(event, _link.url, +useRuntimeConfig(event).redirectStatusCode)
    }
  }
})

export const BASE_PATH = '/baby-feed'

export function withBasePath(path: string): string {
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path
  if (path === '' || path === '/') return `${BASE_PATH}/`
  return `${BASE_PATH}/${path.replace(/^\/+/, '')}`
}

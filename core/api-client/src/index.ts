import createClient, { ClientOptions } from 'openapi-fetch'
import type { paths } from './schema'

export default (clientOptions: ClientOptions) => createClient<paths>(clientOptions)

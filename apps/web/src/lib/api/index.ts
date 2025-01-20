import createClient from 'openapi-fetch'
import type { paths } from './schema'

const API_BASE_URL = 'http://localhost:8000/'
const client = createClient<paths>({ baseUrl: API_BASE_URL })

export default client

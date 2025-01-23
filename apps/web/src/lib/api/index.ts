import createClient from '@noctf/api-client'

const API_BASE_URL = 'http://localhost:8000/'
const client = createClient({ baseUrl: API_BASE_URL })

export default client

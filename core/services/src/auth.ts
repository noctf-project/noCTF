
export class AuthService {
  constructor() {
  }

  async getProviders(): Promise<{
    type: string,
    name?: string,
    image_src?: string
  }[]> {
    return [
      {
        type: 'email'
      },
      {
        type: 'oauth',
        name: 'discord'
      }
    ];
  }
}
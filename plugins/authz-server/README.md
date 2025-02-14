# authz_server plugin

This plugin allows noCTF to act as an OAuth 2.0 authorization server.

Clients are configurable under the `plugin:authz_server` config namespace:

```json
{
    "clients": [
        {
            "client_id": "asdf",
            "client_secret": "zxcv",
            "redirect_uri": "https://yourapp/oauth/callback",
        }
    ]
}
```

> [!CAUTION]
> Scopes are currently not properly enforced, so a client may use the token
> obtained from the token endpoint to access any API endpoint authenticated as
> the user.
